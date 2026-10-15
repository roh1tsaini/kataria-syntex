import {
  render,
  screen,
  fireEvent,
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
jest.mock("react-native-qrcode-svg", () => "QRCode");
jest.mock("@/components/ui/sheet", () => {
  const { Text, View } = require("react-native");
  return {
    Sheet: ({ open, children }: { open: boolean; children: unknown }) =>
      open ? <View>{children}</View> : null,
    SheetHeader: ({ children }: { children: unknown }) => (
      <View>{children}</View>
    ),
    SheetTitle: ({ children }: { children: unknown }) => (
      <Text>{children}</Text>
    ),
    SheetDescription: ({ children }: { children: unknown }) => (
      <Text>{children}</Text>
    ),
  };
});

const mockLookupIdentifier = jest.fn();
const mockRequestOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockLoginPassword = jest.fn();
const mockSignup = jest.fn();
const mockReplace = jest.fn();
const mockStartQrLogin = jest.fn().mockResolvedValue({
  code: "TEST-CODE",
  claimSecret: "sec",
  payload: "https://example.com/scan",
  expiresAt: new Date(Date.now() + 300000).toISOString(),
});
const mockPollQrLogin = jest.fn().mockResolvedValue("pending");

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock("@kataria-syntex/app-core", () => ({
  useAuth: (selector: any) =>
    selector({
      status: "guest",
      lookupIdentifier: mockLookupIdentifier,
      requestOtp: mockRequestOtp,
      verifyOtp: mockVerifyOtp,
      loginPassword: mockLoginPassword,
      signup: mockSignup,
      startQrLogin: mockStartQrLogin,
      pollQrLogin: mockPollQrLogin,
    }),
  friendlyError: (err: any) => String(err?.message || err),
  ApiError: class ApiError extends Error {
    code = "api_error";
  },
}));

const { AuthScreen } = require("@/screens/auth");

describe("AuthScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders sign in header and input", async () => {
    await render(<AuthScreen next={null} />);
    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(
      screen.getByPlaceholderText("+91 98765 43210 or you@gmail.com"),
    ).toBeTruthy();
  });

  it("submits identifier and moves to OTP step when account exists", async () => {
    mockLookupIdentifier.mockResolvedValueOnce({
      exists: true,
      hasPassword: true,
      registrationClosed: false,
    });
    mockRequestOtp.mockResolvedValueOnce(undefined);

    await render(<AuthScreen next={null} />);
    const input = screen.getByPlaceholderText(
      "+91 98765 43210 or you@gmail.com",
    );
    await fireEvent.changeText(input, "user@example.com");

    const continueBtn = screen.getByLabelText("Continue sign in");
    await waitFor(() => {
      expect(continueBtn.props.accessibilityState.disabled).toBe(false);
    });

    await fireEvent.press(continueBtn);

    await waitFor(() => {
      expect(mockLookupIdentifier).toHaveBeenCalledWith("user@example.com");
      expect(mockRequestOtp).toHaveBeenCalledWith("user@example.com");
      expect(screen.getByText("Verification")).toBeTruthy();
    });
  });

  it("switches to QR tab when pressed", async () => {
    await render(<AuthScreen next={null} />);
    const qrTab = screen.getByRole("tab", { name: /Instant QR Login/i });
    await fireEvent.press(qrTab);
    await waitFor(() => {
      expect(screen.getByText("Scan with a signed-in device.")).toBeTruthy();
    });
  });

  it("completes signup with the verified code instead of requesting a second OTP", async () => {
    mockLookupIdentifier.mockResolvedValueOnce({
      exists: true,
      hasPassword: false,
      registrationClosed: false,
    });
    mockRequestOtp.mockResolvedValueOnce(undefined);
    mockVerifyOtp.mockResolvedValueOnce({ outcome: "needs_signup" });
    mockSignup.mockResolvedValueOnce(undefined);

    await render(<AuthScreen next={null} />);
    const identifierInput = screen.getByPlaceholderText(
      "+91 98765 43210 or you@gmail.com",
    );
    await fireEvent.changeText(identifierInput, "user@example.com");
    const continueBtn = screen.getByLabelText("Continue sign in");
    await waitFor(() =>
      expect(continueBtn.props.accessibilityState.disabled).toBe(false),
    );
    await fireEvent.press(continueBtn);

    const otpInput = await screen.findByLabelText("6-digit verification code");
    await fireEvent.changeText(otpInput, "123456");
    const verifyBtn = screen.getByLabelText("Verify code");
    await waitFor(() =>
      expect(verifyBtn.props.accessibilityState.disabled).toBe(false),
    );
    await fireEvent.press(verifyBtn);

    await screen.findByText("Set up account");
    expect(mockRequestOtp).toHaveBeenCalledTimes(1);

    await fireEvent.changeText(
      screen.getByLabelText("Full name"),
      "Rohit Saini",
    );
    await fireEvent.changeText(
      screen.getByLabelText("Create password"),
      "longenough1",
    );
    const submitBtn = screen.getByLabelText("Submit account details");
    await waitFor(() =>
      expect(submitBtn.props.accessibilityState.disabled).toBe(false),
    );
    await fireEvent.press(submitBtn);

    expect(mockSignup).toHaveBeenCalledWith({
      identifier: "user@example.com",
      name: "Rohit Saini",
      password: "longenough1",
      code: "123456",
    });
    expect(mockRequestOtp).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("shows the closed-registration notice before any OTP request, then clears it", async () => {
    mockLookupIdentifier.mockResolvedValueOnce({
      exists: false,
      hasPassword: false,
      registrationClosed: true,
    });
    mockLookupIdentifier.mockResolvedValueOnce({
      exists: true,
      hasPassword: true,
      registrationClosed: false,
    });
    mockRequestOtp.mockResolvedValueOnce(undefined);

    await render(<AuthScreen next={null} />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("+91 98765 43210 or you@gmail.com"),
      "user@example.com",
    );
    const continueBtn = screen.getByLabelText("Continue sign in");
    await waitFor(() =>
      expect(continueBtn.props.accessibilityState.disabled).toBe(false),
    );
    await fireEvent.press(continueBtn);

    await screen.findByText("Registration closed");
    expect(
      screen.getByText("New account registration is currently closed."),
    ).toBeTruthy();
    expect(mockRequestOtp).not.toHaveBeenCalled();

    // A later attempt is its own lookup: the notice must not linger.
    await fireEvent.press(continueBtn);
    await screen.findByLabelText("6-digit verification code");
    expect(mockRequestOtp).toHaveBeenCalledWith("user@example.com");
    expect(screen.queryByText("Registration closed")).toBeNull();
  });
});
