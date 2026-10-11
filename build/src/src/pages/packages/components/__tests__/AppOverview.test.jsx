import { render, screen } from "@testing-library/react";
import AppOverview from "pages/packages/components/AppOverview";
import { MEVBOOST_PACKAGE } from "health/clients";

const { useHealthMock, lostDataCardMock } = vi.hoisted(() => ({ useHealthMock: vi.fn(), lostDataCardMock: vi.fn() }));
vi.mock("health/HealthProvider", () => ({ useHealth: useHealthMock }));
vi.mock("components/health/FindingRow", () => ({ default: ({ finding }) => <li>finding {finding.id}</li> }));
vi.mock("pages/packages/components/PackageViews/Controls", () => ({ default: () => <div>controls</div> }));
vi.mock("pages/packages/components/PackageViews/Details", () => ({ default: () => <div>details</div> }));
vi.mock("pages/packages/apps/mevboost/RelaysCard", () => ({ default: ({ dnp }) => <div>relays card for {dnp.name}</div> }));
vi.mock("pages/packages/components/LostDataCard", () => ({
  default: props => {
    lostDataCardMock(props);
    return <div>lost data card for {props.dnp.name}</div>;
  },
}));

beforeEach(() => {
  useHealthMock.mockReturnValue({ allFindings: [] });
  lostDataCardMock.mockReset();
});

describe("AppOverview", () => {
  it("shows the lost-data card first, then the Relays card on the MEV-Boost app page", () => {
    const { container } = render(<AppOverview dnp={{ name: MEVBOOST_PACKAGE }} isCore={false} />);
    expect(screen.getByText(`relays card for ${MEVBOOST_PACKAGE}`)).toBeInTheDocument();
    expect(container.firstChild.firstChild).toHaveTextContent("lost data card for");
    expect(container.firstChild.children[1]).toHaveTextContent("relays card for");
  });

  it("shows no Relays card on other app pages, but the lost-data card on every one", () => {
    render(<AppOverview dnp={{ name: "ln.dnp.dappnode.eth" }} isCore={false} />);
    expect(screen.queryByText(/relays card/)).toBeNull();
    expect(screen.getByText("lost data card for ln.dnp.dappnode.eth")).toBeInTheDocument();
    expect(screen.getByText("controls")).toBeInTheDocument();
  });

  it("leaves the lost-data findings to the card, and hides the Home finding once a volume is recovered", () => {
    const dismiss = vi.fn();
    const RP = "rocketpool.avado.dnp.dappnode.eth";
    useHealthMock.mockReturnValue({
      dismiss,
      allFindings: [
        { id: `lost-data:${RP}:old`, appId: RP },
        { id: `app-stopped:${RP}`, appId: RP },
      ],
    });
    render(<AppOverview dnp={{ name: RP }} isCore={false} />);
    expect(screen.queryByText(`finding lost-data:${RP}:old`)).toBeNull();
    expect(screen.getByText(`finding app-stopped:${RP}`)).toBeInTheDocument();
    lostDataCardMock.mock.calls[0][0].onRecovered("old");
    expect(dismiss).toHaveBeenCalledWith(`lost-data:${RP}:old`);
  });
});
