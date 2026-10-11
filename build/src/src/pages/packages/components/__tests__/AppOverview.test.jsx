import { render, screen } from "@testing-library/react";
import AppOverview from "pages/packages/components/AppOverview";
import { MEVBOOST_PACKAGE } from "health/clients";

vi.mock("health/HealthProvider", () => ({ useHealth: () => ({ allFindings: [] }) }));
vi.mock("pages/packages/components/PackageViews/Controls", () => ({ default: () => <div>controls</div> }));
vi.mock("pages/packages/components/PackageViews/Details", () => ({ default: () => <div>details</div> }));
vi.mock("pages/packages/apps/mevboost/RelaysCard", () => ({ default: ({ dnp }) => <div>relays card for {dnp.name}</div> }));

describe("AppOverview", () => {
  it("shows the Relays card first on the MEV-Boost app page", () => {
    const { container } = render(<AppOverview dnp={{ name: MEVBOOST_PACKAGE }} isCore={false} />);
    expect(screen.getByText(`relays card for ${MEVBOOST_PACKAGE}`)).toBeInTheDocument();
    expect(container.firstChild.firstChild).toHaveTextContent("relays card for");
  });

  it("shows no Relays card on other app pages", () => {
    render(<AppOverview dnp={{ name: "ln.dnp.dappnode.eth" }} isCore={false} />);
    expect(screen.queryByText(/relays card/)).toBeNull();
    expect(screen.getByText("controls")).toBeInTheDocument();
  });
});
