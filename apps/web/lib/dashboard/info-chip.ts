export type InfoChipInteraction =
  | { type: "toggle" }
  | { type: "dismiss" }
  | { type: "outside_pointer_down"; isTargetInside: boolean }
  | { type: "keydown"; key: string };

export function reduceInfoChipOpenState(
  isOpen: boolean,
  interaction: InfoChipInteraction
): boolean {
  switch (interaction.type) {
    case "toggle":
      return !isOpen;
    case "dismiss":
      return false;
    case "outside_pointer_down":
      return interaction.isTargetInside ? isOpen : false;
    case "keydown":
      return interaction.key === "Escape" ? false : isOpen;
    default:
      return isOpen;
  }
}
