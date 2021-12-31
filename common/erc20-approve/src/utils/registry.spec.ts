import { EthereumAddressRegistry } from './registry';

describe('EthereumAddressRegistry', () => {
  const mockProvider = { getCode: jest.fn() };
  const mockClient = { get: jest.fn() };

  const etherscanExchangeResponse = { data: `<a href='/accounts/label/exchange'>Exchange</a>` };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use passed exchange addresses', async () => {
    const addresses: string[] = ['0xEXCHANGE1', '0xEXCHANGE2'];

    const registry = new EthereumAddressRegistry(mockClient as any, mockProvider as any, addresses);

    let result = await registry.isExchange(addresses[0]);

    expect(result).toStrictEqual(true);
    expect(mockClient.get).toBeCalledTimes(0);

    result = await registry.isExchange(addresses[1]);

    expect(result).toStrictEqual(true);
    expect(mockClient.get).toBeCalledTimes(0);

    // --------------------------

    mockClient.get.mockResolvedValueOnce(etherscanExchangeResponse);
    result = await registry.isExchange('0xNEWEXCHANGE', { useExternalApi: true });

    expect(result).toStrictEqual(true);
    expect(mockClient.get).toBeCalledTimes(1);

    // --------------------------

    mockClient.get.mockClear();
    mockClient.get.mockResolvedValueOnce({ data: 'RANDOM HTML' });
    result = await registry.isExchange('0xUNKNOWN');

    expect(result).toStrictEqual(false);
    expect(mockClient.get).toBeCalledTimes(1);
  });

  it('should not use external api if `useExternalApi` is set to false', async () => {
    const registry = new EthereumAddressRegistry(mockClient as any, mockProvider as any, []);
    const result = await registry.isExchange('0xUNKNOWN', { useExternalApi: false });

    expect(result).toStrictEqual(false);
    expect(mockClient.get).toBeCalledTimes(0);
  });

  it('should use external api if `useExternalApi` is set to true', async () => {
    const registry = new EthereumAddressRegistry(mockClient as any, mockProvider as any, []);

    mockClient.get.mockResolvedValueOnce(etherscanExchangeResponse);

    let result = await registry.isExchange('0xUNKNOWN1', { useExternalApi: true });

    expect(result).toStrictEqual(true);
    expect(mockClient.get).toBeCalledTimes(1);

    // --------------------------

    mockClient.get.mockClear();
    mockClient.get.mockResolvedValueOnce({
      data: `Some random text <a href='/accounts/label/dex'>DEX</a>`
    });

    result = await registry.isExchange('0xUNKNOWN2', { useExternalApi: true });

    expect(result).toStrictEqual(false);
    expect(mockClient.get).toBeCalledTimes(1);
  });

  it('should check contract code', async () => {
    const registry = new EthereumAddressRegistry(mockClient as any, mockProvider as any, []);

    mockProvider.getCode.mockResolvedValueOnce('0x');

    let result = await registry.isContract('0xADDRESS1');

    expect(result).toStrictEqual(false);
    expect(mockProvider.getCode).toBeCalledTimes(1);

    mockProvider.getCode.mockClear();
    mockProvider.getCode.mockResolvedValueOnce('0xSOMECODE');

    result = await registry.isContract('0xADDRESS2');

    expect(result).toStrictEqual(true);
    expect(mockProvider.getCode).toBeCalledTimes(1);
  });

  it('should cache contract addresses', async () => {
    const registry = new EthereumAddressRegistry(mockClient as any, mockProvider as any, []);

    mockProvider.getCode.mockResolvedValueOnce('0x');

    let result = await registry.isContract('0xUNKNOWN1');

    expect(result).toStrictEqual(false);
    expect(mockProvider.getCode).toBeCalledTimes(1);

    // --------------------

    mockProvider.getCode.mockClear();
    mockProvider.getCode.mockResolvedValueOnce('0x');

    result = await registry.isContract('0xUNKNOWN1');

    expect(result).toStrictEqual(false);
    expect(mockProvider.getCode).toBeCalledTimes(0);

    // --------------------

    mockProvider.getCode.mockReset();
    mockProvider.getCode.mockResolvedValueOnce('0xCODE');

    result = await registry.isContract('0xUNKNOWN2');

    expect(result).toStrictEqual(true);
    expect(mockProvider.getCode).toBeCalledTimes(1);

    mockProvider.getCode.mockClear();

    result = await registry.isContract('0xUNKNOWN2');

    expect(result).toStrictEqual(true);
    expect(mockProvider.getCode).toBeCalledTimes(0);
  });

  it('should cache exchange addresses', async () => {
    const registry = new EthereumAddressRegistry(mockClient as any, mockProvider as any, []);
    const dexResponse = { data: `<a href='/accounts/label/dex'>DEX</a>` };

    mockClient.get.mockResolvedValue(dexResponse);

    let result = await registry.isExchange('0xUNKNOWN1', { useExternalApi: true });

    expect(result).toStrictEqual(false);
    expect(mockClient.get).toBeCalledTimes(1);

    mockClient.get.mockClear();

    result = await registry.isExchange('0xUNKNOWN1', { useExternalApi: true });

    expect(result).toStrictEqual(false);
    expect(mockClient.get).toBeCalledTimes(0);

    // --------------------

    mockClient.get.mockClear();
    mockClient.get.mockResolvedValue(etherscanExchangeResponse);

    result = await registry.isExchange('0xUNKNOWN2', { useExternalApi: true });

    expect(result).toStrictEqual(true);
    expect(mockClient.get).toBeCalledTimes(1);

    mockClient.get.mockClear();

    result = await registry.isExchange('0xUNKNOWN2', { useExternalApi: true });

    expect(result).toStrictEqual(true);
    expect(mockClient.get).toBeCalledTimes(0);
  });

  it('should return false on client errors', async () => {
    const registry = new EthereumAddressRegistry(mockClient as any, mockProvider as any, []);

    mockClient.get.mockRejectedValue('Client error');

    const result = await registry.isExchange('0xUNKNOWN', { useExternalApi: true });

    expect(result).toStrictEqual(false);
  });

  it('should clear outdated cache', async () => {
    const exchangeAddresses = ['0xEXCHANGE1', '0xEXCHANGE2'];

    mockClient.get.mockResolvedValue({ data: 'RANDOM HTML' });
    mockProvider.getCode.mockResolvedValue('0x');

    const registry = new EthereumAddressRegistry(
      mockClient as any,
      mockProvider as any,
      exchangeAddresses
    );

    // Should not remove passed exchanges
    // --------------------

    await registry.isExchange(exchangeAddresses[0], { useExternalApi: true });
    expect(mockClient.get).toHaveBeenCalledTimes(0);

    registry.clearOutdatedCache(Number(new Date()));
    await registry.isExchange(exchangeAddresses[1], { useExternalApi: true });
    expect(mockClient.get).toHaveBeenCalledTimes(0);

    // Should not remove not outdated addresses
    // --------------------

    mockClient.get.mockClear();
    mockProvider.getCode.mockClear();

    await registry.isContract('0xADDRESS1');
    await registry.isExchange('0xADDRESS1', { useExternalApi: true });
    expect(mockClient.get).toHaveBeenCalledTimes(1);
    expect(mockProvider.getCode).toHaveBeenCalledTimes(1);

    registry.clearOutdatedCache(0);

    mockClient.get.mockClear();
    mockProvider.getCode.mockClear();

    await registry.isContract('0xADDRESS1');
    await registry.isExchange('0xADDRESS1', { useExternalApi: true });

    expect(mockClient.get).toHaveBeenCalledTimes(0);
    expect(mockProvider.getCode).toHaveBeenCalledTimes(0);

    // Should remove outdated addresses
    // --------------------

    mockClient.get.mockClear();
    mockProvider.getCode.mockClear();

    await registry.isContract('0xADDRESS2');
    await registry.isExchange('0xADDRESS2', { useExternalApi: true });
    expect(mockClient.get).toHaveBeenCalledTimes(1);
    expect(mockProvider.getCode).toHaveBeenCalledTimes(1);

    // wait 500ms
    await new Promise((res) => setTimeout(res, 500));
    registry.clearOutdatedCache(Number(new Date()) - 499);

    mockClient.get.mockClear();
    mockProvider.getCode.mockClear();

    await registry.isContract('0xADDRESS2');
    await registry.isExchange('0xADDRESS2', { useExternalApi: true });
    expect(mockClient.get).toHaveBeenCalledTimes(1);
    expect(mockProvider.getCode).toHaveBeenCalledTimes(1);
  });
});
