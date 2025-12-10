declare module "@rails/actioncable" {
  export type Subscription = {
    unsubscribe(): void;
  };

  export type Cable = {
    subscriptions: {
      create(
        identifier: Record<string, unknown>,
        handlers: {
          received?: (data: unknown) => void;
          connected?: () => void;
          disconnected?: () => void;
        }
      ): Subscription;
    };
    disconnect(): void;
  };

  export function createConsumer(url?: string): Cable;
}
