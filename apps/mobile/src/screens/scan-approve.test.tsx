import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

jest.mock("react", () => jest.requireActual("../../../../node_modules/react"));
jest.mock("react-native-worklets", () =>
  require("react-native-worklets/src/mock"),
);
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockApi = jest.fn();
const mockApproveQrLogin = jest.fn();
let mockStatus: "loading" | "guest" | "authed" = "authed";

jest.mock("@kataria-syntex/app-core", () => ({
  api: (...args: unknown[]) => mockApi(...args),
  friendlyError: (err: any) => String(err?.message || err),
  useAuth: (selector: any) =>
    selector({ status: mockStatus, approveQrLogin: mockApproveQrLogin }),
}));

const { ScanApproveScreen } = require("@/screens/scan-approve");

const CODE = "AAAA-BBBB-CCCC-1234";

describe("ScanApproveScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus = "authed";
    mockApi.mockResolvedValue({
      status: "pending",
      targetName: null,
      deviceLabel: null,
    });
    mockApproveQrLogin.mockResolvedValue({
      grantedSelf: false,
      grantedName: "Rohit Saini",
    });
  });

  it("shows the claim, account and code-suffix rows with fallbacks", async () => {
    await render(<ScanApproveScreen code={CODE} />);
    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(1));

    expect(screen.getByText("Approve this login?")).toBeTruthy();
    expect(
      screen.getByText("Check the device and code match that screen."),
    ).toBeTruthy();
    expect(screen.getByText("Claims to be")).toBeTruthy();
    expect(screen.getByText("unknown device")).toBeTruthy();
    expect(screen.getByText("Signs in as")).toBeTruthy();
    expect(screen.getByText("you")).toBeTruthy();
    expect(screen.getByText("Code ends in")).toBeTruthy();
    expect(screen.getByText("1234")).toBeTruthy();
  });

  it("names the device and account on success", async () => {
    mockApi.mockResolvedValue({
      status: "pending",
      targetName: "Rohit Saini",
      deviceLabel: "Office Chrome",
    });

    await render(<ScanApproveScreen code={CODE} />);
    await fireEvent.press(screen.getByLabelText("Approve login"));

    await screen.findByText("Approved");
    expect(screen.getByText(/is now signed in as/)).toBeTruthy();
    expect(screen.getByText("Rohit Saini")).toBeTruthy();
  });

  it("redirects a guest to sign-in with the approve route as next", async () => {
    mockStatus = "guest";
    await render(<ScanApproveScreen code={CODE} />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: "/auth",
        params: { next: `/login/scan/${CODE}` },
      }),
    );
  });
});
