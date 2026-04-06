# Testing Setup Guide

## Current Status
✅ Unit tests created for validation system  
❌ Test dependencies not installed  

## Required Dependencies

Install testing libraries:
```bash
npm install --save-dev @testing-library/react @testing-library/react-hooks @types/jest jest jest-environment-jsdom
```

## Running Tests

Once dependencies are installed:
```bash
npm test
```

## Test Coverage

### Validation System Tests
- `src/app/grants/builder/__tests__/useBuilderValidation.test.ts`
  - Error validation (blocks generation)
  - Warning validation (allows with confirmation)
  - Info validation (suggestions)
  - Edge cases (invalid dates, null grants, etc.)
  - Categorization logic

**Coverage:** 15 test cases covering all validation rules

## Next Steps

1. Install dependencies
2. Run tests: `npm test`
3. Add budget template tests
4. Add integration tests for Builder workflow
5. Set up CI/CD test automation

## Test Files Created
- ✅ `useBuilderValidation.test.ts` - 15 test cases
- ⏳ Budget template tests (TODO)
- ⏳ Integration tests (TODO)
