module slot_machine::game {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::event;
    use sui::random::{Self, Random};

    // ======== Errors ========

    const EInsufficientBet: u64 = 0;
    const EBetTooLarge: u64 = 1;
    const EInsufficientHouseFunds: u64 = 2;

    // ======== Constants ========

    /// Number of distinct symbols on each reel (0..5)
    const SYMBOLS_COUNT: u8 = 6;

    /// Minimum bet: 0.01 SUI
    const MIN_BET: u64 = 10_000_000;

    /// Maximum bet: 0.5 SUI
    const MAX_BET: u64 = 500_000_000;

    // ======== Objects ========

    /// Admin capability – transferred to deployer
    public struct AdminCap has key, store {
        id: UID,
    }

    /// The shared slot machine holding the house balance
    public struct SlotMachine has key {
        id: UID,
        balance: Balance<SUI>,
    }

    // ======== Events ========

    /// Emitted after every spin
    public struct GameResult has copy, drop {
        player: address,
        bet_amount: u64,
        reel1: u8,
        reel2: u8,
        reel3: u8,
        payout: u64,
    }

    // ======== Init ========

    fun init(ctx: &mut TxContext) {
        transfer::transfer(
            AdminCap { id: object::new(ctx) },
            ctx.sender(),
        );

        transfer::share_object(SlotMachine {
            id: object::new(ctx),
            balance: balance::zero(),
        });
    }

    // ======== Player functions ========

    /// Spin the slot machine.
    /// Requires `&Random` (object at 0x8) for on-chain randomness.
    entry fun play(
        machine: &mut SlotMachine,
        bet: Coin<SUI>,
        r: &Random,
        ctx: &mut TxContext,
    ) {
        let bet_value = coin::value(&bet);
        assert!(bet_value >= MIN_BET, EInsufficientBet);
        assert!(bet_value <= MAX_BET, EBetTooLarge);

        // Calculate max possible payout (jackpot = 10x) and check house can cover
        let max_payout = bet_value * 10;
        assert!(balance::value(&machine.balance) >= max_payout, EInsufficientHouseFunds);

        // Add bet to house
        balance::join(&mut machine.balance, coin::into_balance(bet));

        // Roll 3 reels using Sui Random
        let mut generator = random::new_generator(r, ctx);
        let reel1 = random::generate_u8_in_range(&mut generator, 0, SYMBOLS_COUNT - 1);
        let reel2 = random::generate_u8_in_range(&mut generator, 0, SYMBOLS_COUNT - 1);
        let reel3 = random::generate_u8_in_range(&mut generator, 0, SYMBOLS_COUNT - 1);

        // Determine payout
        let payout = calculate_payout(bet_value, reel1, reel2, reel3);

        // Pay winner
        if (payout > 0) {
            let payout_coin = coin::from_balance(
                balance::split(&mut machine.balance, payout),
                ctx,
            );
            transfer::public_transfer(payout_coin, ctx.sender());
        };

        // Emit result event
        event::emit(GameResult {
            player: ctx.sender(),
            bet_amount: bet_value,
            reel1,
            reel2,
            reel3,
            payout,
        });
    }

    // ======== Admin functions ========

    /// Deposit SUI into the house balance
    entry fun deposit(
        _admin: &AdminCap,
        machine: &mut SlotMachine,
        coin: Coin<SUI>,
    ) {
        balance::join(&mut machine.balance, coin::into_balance(coin));
    }

    /// Withdraw SUI from the house balance
    entry fun withdraw(
        _admin: &AdminCap,
        machine: &mut SlotMachine,
        amount: u64,
        ctx: &mut TxContext,
    ) {
        let coin = coin::from_balance(
            balance::split(&mut machine.balance, amount),
            ctx,
        );
        transfer::public_transfer(coin, ctx.sender());
    }

    // ======== View functions ========

    public fun house_balance(machine: &SlotMachine): u64 {
        balance::value(&machine.balance)
    }

    // ======== Internal ========

    fun calculate_payout(bet: u64, r1: u8, r2: u8, r3: u8): u64 {
        if (r1 == r2 && r2 == r3) {
            // Jackpot: 3 of a kind = 10x
            bet * 10
        } else if (r1 == r2 || r2 == r3 || r1 == r3) {
            // Win: 2 of a kind = 2x
            bet * 2
        } else {
            // Loss
            0
        }
    }
}
