import { View } from "react-native";
import { useRouter } from "expo-router";
import { HelpCircle } from "lucide-react-native";

import { Page } from "@/components/page";
import { Button, ButtonText } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function NotFoundScreen() {
  const router = useRouter();

  return (
    <Page contentClassName="items-center justify-center min-h-full py-12">
      <Card className="w-full max-w-sm items-center p-6 text-center">
        <View className="mb-4 size-12 items-center justify-center rounded-full bg-muted">
          <HelpCircle size={24} className="text-muted-foreground" />
        </View>
        <CardTitle className="text-lg">Page not found</CardTitle>
        <CardDescription className="mt-1">
          The page you are looking for does not exist.
        </CardDescription>
        <Button
          className="mt-6 w-full"
          onPress={() => router.replace("/")}
          accessibilityLabel="Go back to home"
        >
          <ButtonText>Go home</ButtonText>
        </Button>
      </Card>
    </Page>
  );
}
