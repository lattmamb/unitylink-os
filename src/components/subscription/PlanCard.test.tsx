import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanCard, type SubscriptionPlan } from "@/components/subscription/PlanCard";

const plan: SubscriptionPlan = {
  id: "p1",
  name: "Commuter",
  description: "Daily rural commute",
  price: 149,
  vehicle: "Nissan Leaf",
  popular: true,
  features: ["Unlimited miles", "Home charging"],
};

describe("PlanCard", () => {
  it("renders plan details", () => {
    render(<PlanCard plan={plan} onSubscribe={() => {}} isLoading={false} />);
    expect(screen.getByText("Commuter")).toBeInTheDocument();
    expect(screen.getByText("Daily rural commute")).toBeInTheDocument();
    expect(screen.getByText("$149")).toBeInTheDocument();
    expect(screen.getByText("Nissan Leaf")).toBeInTheDocument();
    expect(screen.getByText("Most Popular")).toBeInTheDocument();
  });

  it("calls onSubscribe with the plan name", async () => {
    const user = userEvent.setup();
    const onSubscribe = vi.fn();
    render(<PlanCard plan={plan} onSubscribe={onSubscribe} isLoading={false} />);
    await user.click(screen.getByRole("button", { name: "Subscribe" }));
    expect(onSubscribe).toHaveBeenCalledWith("Commuter");
  });

  it("disables the button while loading", () => {
    render(<PlanCard plan={plan} onSubscribe={() => {}} isLoading={true} />);
    expect(screen.getByRole("button", { name: /Processing/i })).toBeDisabled();
  });
});