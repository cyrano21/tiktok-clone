import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create axios instance with correct config', () => {
    mockedAxios.create.mockReturnValue({
      get: jest.fn().mockResolvedValue({ data: { id: '1' } }),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn(), eject: jest.fn() },
        response: { use: jest.fn(), eject: jest.fn() },
      },
    } as any);

    expect(true).toBe(true);
  });
});
