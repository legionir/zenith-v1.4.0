/**
 * @zenith/testing - Testing utilities for Zenith Framework
 */

export * from './testing';
export {
  createTestHarness,
  trackEffect,
  waitFor,
  createMockSignal,
  expectSignal,
  createMockResource,
  render,
  zenithMatchers,
  auditAccessibility,
  expectAccessible,
} from './testing';
export type {
  TestHarness,
  TrackedEffect,
  MockResource,
  RenderResult,
  A11yImpact,
  A11yViolation,
  A11yAuditOptions,
  A11yAuditResult,
} from './testing';
