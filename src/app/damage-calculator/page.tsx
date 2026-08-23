import type { Metadata } from "next";
import { DamageCalculator } from "@/components/calculator/DamageCalculator";

export const metadata: Metadata = {
  title: "Damage Calculator",
  description: "Calculate TFT basic attack and ability damage with defenses, shields, items, and targeted trait buffs.",
};

export default function DamageCalculatorPage() {
  return <DamageCalculator />;
}
