export const ADDRS = {
  FACTORY: import.meta.env.VITE_FACTORY as `0x${string}` | undefined,
  POOL: import.meta.env.VITE_POOL as `0x${string}` | undefined,
  TOKEN: import.meta.env.VITE_TOKEN as `0x${string}` | undefined, // PYUSD en tu red
};

export const erc20Abi = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const factoryAbi = [
  {
    type: "function",
    name: "createCircle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "name", type: "string" },
      { name: "quorumBps", type: "uint256" },
      { name: "endTime", type: "uint256" },
    ],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "circlesLength",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "circles",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

export const poolAbi = [
  {
    type: "function",
    name: "token",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "contribute",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "submitClaim",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "string" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "voteClaim",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "bool" }],
    outputs: [],
  },
  {
    type: "function",
    name: "finalizeClaim",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }],
    outputs: [],
  },
] as const;
