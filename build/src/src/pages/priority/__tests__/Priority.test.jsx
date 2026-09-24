import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { createStore } from "redux";

const { getStatusMock, checkoutMock, portalMock, paramsMock } = vi.hoisted(() => ({
  getStatusMock: vi.fn(),
  checkoutMock: vi.fn(),
  portalMock: vi.fn(),
  paramsMock: vi.fn()
}));

vi.mock("pages/priority/priorityApi", async importOriginal => ({
  ...(await importOriginal()),
  getStatus: getStatusMock,
  createCheckout: checkoutMock,
  createPortal: portalMock
}));
vi.mock("services/dappnodeStatus/selectors", async importOriginal => ({
  ...(await importOriginal()),
  getDappnodeParams: paramsMock
}));
vi.mock("pages/priority/components/CareSection", () => ({
  default: ({ nodeId }) => <div data-testid="care-section">{nodeId}</div>
}));

import Priority, { BENEFITS } from "pages/priority/components/Priority";

const NODE = "0x2c7536e3605d9c16a7a3D7b1898e529396a65c23";

const renderPage = () =>
  render(
    <Provider store={createStore(() => ({}))}>
      <MemoryRouter initialEntries={["/priority"]}>
        <Priority />
      </MemoryRouter>
    </Provider>
  );

beforeEach(() => {
  vi.resetAllMocks();
  paramsMock.mockReturnValue({ nodeid: NODE });
});

describe("Priority Care page", () => {
  it("offers Priority Care with the plain-language benefits and prices", async () => {
    getStatusMock.mockResolvedValue({ hasSubscription: false, subscription: null, serverTime: 1 });
    renderPage();
    expect(screen.getByRole("heading", { name: "Priority Care" })).toBeInTheDocument();
    expect(await screen.findByText("Get Priority Care")).toBeInTheDocument();
    for (const b of BENEFITS) expect(screen.getByText(b)).toBeInTheDocument();
    expect(screen.getByText(/save €24/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subscribe monthly" })).toBeInTheDocument();
    expect(screen.queryByText(/free for 14 days/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("care-section")).not.toBeInTheDocument();
  });

  it("keeps the original support benefits first, above the Priority Care ones", () => {
    expect(BENEFITS.slice(0, 3)).toEqual([
      "Priority email support with 24-hour response time",
      "Access to private support channels",
      "Personal 1-on-1 support sessions",
    ]);
    expect(BENEFITS.length).toBeGreaterThan(3);
  });

  it("does not promise remote access in the benefits", () => {
    expect(BENEFITS.join(" ")).not.toMatch(/remote|let avado in/i);
  });

  it("shows the 14-day trial when the box is trial eligible", async () => {
    getStatusMock.mockResolvedValue({ hasSubscription: false, subscription: null, serverTime: 1, trialEligible: true });
    renderPage();
    expect(await screen.findByText("Try Priority Care free for 14 days")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start free trial, monthly" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start free trial, yearly" })).toBeInTheDocument();
  });

  it("starts checkout for the chosen plan (existing flow)", async () => {
    getStatusMock.mockResolvedValue({ hasSubscription: false, subscription: null, serverTime: 1 });
    checkoutMock.mockRejectedValue(new Error("Your AVADO needs a system update before it can manage subscriptions."));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Subscribe yearly" }));
    await waitFor(() => expect(checkoutMock).toHaveBeenCalledWith(NODE, "yearly"));
    expect(await screen.findByRole("alert")).toHaveTextContent("needs a system update");
  });

  it("shows the subscription, billing and the Priority Care alerts for subscribers", async () => {
    getStatusMock.mockResolvedValue({
      hasSubscription: true,
      subscription: { planType: "monthly", status: "active", endDate: "2026-10-24T00:00:00Z" },
      serverTime: 1
    });
    renderPage();
    expect(await screen.findByText("Your subscription")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage billing" })).toBeInTheDocument();
    expect(screen.getByTestId("care-section")).toHaveTextContent(NODE);
  });

  it("labels a trial subscription", async () => {
    getStatusMock.mockResolvedValue({
      hasSubscription: true,
      subscription: { planType: "yearly", status: "trialing", endDate: "2026-10-08T00:00:00Z" },
      serverTime: 1
    });
    renderPage();
    expect(await screen.findByText("Free trial")).toBeInTheDocument();
    expect(screen.getByText("Trial ends on")).toBeInTheDocument();
  });

  it("explains an unreachable billing service", async () => {
    getStatusMock.mockRejectedValue(new Error("Network Error"));
    renderPage();
    expect(await screen.findByText(/could not be reached \(Network Error\)/)).toBeInTheDocument();
  });
});
