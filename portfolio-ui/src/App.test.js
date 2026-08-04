/*
 * App.test.js
 * -----------
 * Covers the routing shell at "/".
 *
 * These used to assert on the owner's hardcoded portfolio. "/" is now a generic
 * landing page — no account is special — so they assert on that instead.
 */

import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  localStorage.clear();
});

test('renders the landing page at "/"', async () => {
  render(<App />);
  expect(await screen.findByText(/PORTFOLIO_AGENT/i)).toBeInTheDocument();
});

test('explains what the product does', async () => {
  render(<App />);
  expect(await screen.findByText(/Upload a CV/i)).toBeInTheDocument();
});

test('offers signup and signin to a logged-out visitor', async () => {
  render(<App />);

  const signup = await screen.findByText(/CREATE ACCOUNT/i);
  expect(signup).toBeInTheDocument();
  expect(signup.closest('a')).toHaveAttribute('href', '/signup');

  expect(screen.getByText(/SIGN IN/i).closest('a')).toHaveAttribute('href', '/login');
});

test('does not present any one account as the site owner', async () => {
  render(<App />);
  await screen.findByText(/PORTFOLIO_AGENT/i);

  /* Guards the regression this change was made to prevent. */
  expect(screen.queryByText(/Rahul/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Chat with my Agent/i)).not.toBeInTheDocument();
});
