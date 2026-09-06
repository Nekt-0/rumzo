import { parseAbi } from 'viem';
export const factoryAbi = parseAbi([
  'struct LaunchedToken { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }',
  'function getLaunchedToken(address token) view returns (LaunchedToken)',
  'function snipeTaxStartBps() view returns(uint256)',
  'function snipeTaxSeconds() view returns(uint256)',
  'function locker() view returns(address)',
  'struct FeePolicySnapshot { address protocolFeeRecipient; uint16 protocolFeeShareBps; uint16 buybackBurnBps; uint16 hookFeeBps; uint16 maxInternalPriceImpactBps; }',
  'function getLaunchFeePolicy(address token) view returns(FeePolicySnapshot)'
]);
export const tokenAbi = parseAbi(['function totalSupply() view returns(uint256)', 'function decimals() view returns(uint8)', 'function name() view returns(string)', 'function symbol() view returns(string)']);
export const curveAbi = parseAbi(['function launchedAt() view returns(uint256)', 'function feeBps() view returns(uint256)']);
export const lockerAbi = parseAbi(['function isLocked(address token) view returns(bool)', 'function lockedTokenSupply(address token) view returns(uint256)']);
