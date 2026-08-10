import { TeamBuilder } from "@/components/builder/TeamBuilder";
import data from "@/data/tft-set.json";
import type { TftSet } from "@/data/types";

export default function Home() {
  return <TeamBuilder data={data as unknown as TftSet} />;
}
