/**
 * Global setup for e2e tests.
 *
 * react-email's render() uses dynamic imports that require
 * --experimental-vm-modules. Since the uuid package breaks under
 * that flag, we mock react-email globally for e2e tests.
 * Email rendering logic is tested separately in unit tests.
 */
jest.mock('react-email', () => ({
  render: jest.fn().mockResolvedValue('<p>Mocked email</p>'),
}));
