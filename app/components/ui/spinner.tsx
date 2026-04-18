import { RiLoaderLine } from "@remixicon/react";

import { cn } from "@/lib/utils";

type SpinnerProps = React.ComponentProps<typeof RiLoaderLine>;

function Spinner({ className, ...props }: SpinnerProps) {
  return <RiLoaderLine role="status" aria-label="Loading" className={cn("size-4 animate-spin", className)} {...props} />;
}

export { Spinner };
