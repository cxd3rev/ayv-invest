export type BrokerAdapter = {
  id: string;
  label: string;
};

export const brokerAdapters: BrokerAdapter[] = [];

export function brokerStatus() {
  return {
    connected: false as const,
    reason: "No broker is connected. Credentials are not stored in this browser.",
  };
}
