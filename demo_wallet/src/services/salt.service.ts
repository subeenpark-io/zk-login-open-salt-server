/**
 * Salt Service - handles communication with Salt Server
 * Uses proxy to hide actual Salt Server endpoint from browser
 */

export class SaltService {
  // Use proxy path (configured in vite.config.ts)
  private readonly endpoint = '/api/salt';

  /**
   * Fetch salt from the deployed Salt Server via proxy
   *
   * @param jwt - OAuth JWT token
   * @returns Salt value
   */
  async fetchSalt(jwt: string): Promise<string> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jwt })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.message || `Salt Server error: ${response.statusText}`
        );
      }

      const data = await response.json();

      if (!data.salt) {
        throw new Error('Salt Server returned invalid response: missing salt field');
      }

      return data.salt;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to fetch salt from Salt Server');
    }
  }
}
