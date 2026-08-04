/*
 * PublicProfile.test.js
 * ---------------------
 * Covers the visitor-facing page: that it renders a generated profile, and that
 * the states where there is nothing to show are handled rather than crashing.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PublicProfile from "./PublicProfile";
import api from "../api/client";

jest.mock("../api/client", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  errorMessage: (err, fallback) => fallback,
  TOKEN_KEY: "portfolio_agent_token",
}));

const READY_PROFILE = {
  username: "ada",
  display_name: "Ada Lovelace",
  headline: "Mathematician",
  location: "London",
  status: "ready",
  data: {
    about: {
      paragraphs: ["I work on analytical engines."],
      facts: [{ label: "Location", value: "London" }],
    },
    stats: [{ value: "1st", label: "Programmer" }],
    skills: ["Mathematics", "Analysis"],
    experience: [],
    projects: [],
  },
};

function renderAt(username = "ada") {
  return render(
    <MemoryRouter initialEntries={[`/u/${username}`]}>
      <Routes>
        <Route path="/u/:username" element={<PublicProfile />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

test("renders the owner identity and generated about section", async () => {
  api.get.mockResolvedValue({ data: READY_PROFILE });

  renderAt();

  expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  expect(screen.getByText("Mathematician")).toBeInTheDocument();
  expect(screen.getByText(/analytical engines/i)).toBeInTheDocument();
});

test("offers a chat button naming the page owner", async () => {
  api.get.mockResolvedValue({ data: READY_PROFILE });

  renderAt();

  expect(
    await screen.findByText(/Chat with Ada Lovelace's Agent/i)
  ).toBeInTheDocument();
});

test("explains itself when the owner has no CV yet", async () => {
  api.get.mockResolvedValue({
    data: { ...READY_PROFILE, status: "empty", data: {} },
  });

  renderAt();

  expect(await screen.findByText(/Nothing here yet/i)).toBeInTheDocument();
});

test("shows an error rather than crashing on an unknown user", async () => {
  api.get.mockRejectedValue({ response: { status: 404 } });

  renderAt("nobody");

  await waitFor(() =>
    expect(screen.getByText(/Profile unavailable/i)).toBeInTheDocument()
  );
});
