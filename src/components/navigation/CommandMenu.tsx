import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";

const groups = [
  ["UnityLink OS", [["Home", "/os"], ["Library", "/os?view=library"], ["Knowledge Graph", "/os?view=graph"], ["Projects", "/os?view=projects"]]],
  ["Mobility", [["Fleet", "/fleet"], ["Rentals", "/rentals"], ["Book a ride", "/booking"], ["On demand", "/on-demand"], ["Charging", "/charging-stations"]]],
  ["Operations", [["Sites", "/locations"], ["Subscriptions", "/subscription"], ["Advertising", "/advertising"], ["Support", "/support"], ["Profile", "/profile"]]],
] as const;

export default function CommandMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault(); setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const go = (path: string) => { setOpen(false); navigate(path); };
  return <CommandDialog open={open} onOpenChange={setOpen}>
    <CommandInput placeholder="Search UnityLink, Fleet, tools, and workspaces…" />
    <CommandList><CommandEmpty>No matching destination.</CommandEmpty>
      {groups.map(([heading, items], index) => <div key={heading}>
        {index > 0 ? <CommandSeparator /> : null}
        <CommandGroup heading={heading}>{items.map(([label, path]) =>
          <CommandItem key={path} onSelect={() => go(path)}>{label}</CommandItem>
        )}</CommandGroup>
      </div>)}
    </CommandList>
  </CommandDialog>;
}
