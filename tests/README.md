# Vitrin CLI Tests

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests
```bash
npm run test:unit
```

### Integration Tests
```bash
npm run test:integration
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Structure

```
tests/
├── setup.ts              # Test environment configuration
├── unit/                 # Unit tests
│   ├── core/
│   │   ├── api.test.ts   # API service
│   │   └── auth.test.ts  # Authentication
│   └── utils/
│       └── build.test.ts # Build utilities
└── integration/          # Integration tests
    └── commands.test.ts  # CLI commands
```

## Writing Tests

### Unit Test Example

```typescript
describe('ApiService', () => {
  it('should create theme version', async () => {
    const mockResponse = { 
      id: '123', 
      version: '1.0.0' 
    };
    
    mockedAxios.post.mockResolvedValue({ 
      data: mockResponse 
    });

    const result = await apiService.createThemeVersion('theme-id', {
      version: '1.0.0',
      changelog: { en: 'Initial release' }
    });

    expect(result).toEqual(mockResponse);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/v2/themes/theme-id/versions/',
      expect.any(Object)
    );
  });
});
```

### Integration Test Example

```typescript
describe('Preview Command', () => {
  it('should upload and preview theme', async () => {
    const themePath = './test-theme.zip';
    const storeId = '123';
    
    await execCommand(`vitrin preview ${storeId} ${themePath}`);
    
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Theme uploaded successfully')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Preview URL:')
    );
  });
});
```

## Mocking

Tests use Jest mocks for external dependencies:

```typescript
// Mock file system
jest.mock('fs');

// Mock HTTP requests
jest.mock('axios');

// Mock authentication
jest.mock('@/core/auth', () => ({
  default: {
    getToken: jest.fn().mockResolvedValue('test-token'),
    requireAuth: jest.fn().mockResolvedValue('test-token')
  }
}));
```

## Test Data

Common test fixtures:

```typescript
const mockTheme = {
  id: 'theme-123',
  name: { en: 'Test Theme' },
  slug: 'test-theme',
  created_at: '2024-01-01T00:00:00Z'
};

const mockDevStore = {
  id: 14,
  name: 'Test Store',
  email: 'test@partner.email',
  link: 'https://test.zidtest.com'
};
```

## Debugging Tests

### Run Specific Test
```bash
npm test -- api.test.ts
```

### Debug Mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Verbose Output
```bash
npm test -- --verbose
```

## CI/CD

Tests run automatically on:
- Pull requests
- Pre-commit hooks
- GitHub Actions

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

## Common Issues

### Authentication in Tests

Tests should not make real API calls. Mock authentication:

```typescript
beforeEach(() => {
  jest.spyOn(auth, 'getToken').mockResolvedValue('mock-token');
});
```

### File System Operations

Use temporary directories for file operations:

```typescript
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const testDir = mkdtempSync(join(tmpdir(), 'vitrin-test-'));
```

### Async Tests

Always use async/await or return promises:

```typescript
it('should handle async operations', async () => {
  const result = await someAsyncFunction();
  expect(result).toBe(expected);
});
```

## Coverage Requirements

- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

View coverage report:
```bash
open coverage/lcov-report/index.html
```