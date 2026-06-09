import { useEffect } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const toasts = document.querySelectorAll("[data-sonner-toast]");
      toasts.forEach((toastEl) => {
        const el = toastEl as HTMLElement;
        if (el.dataset.processedWidth === "true") return;

        const text = el.innerText || el.textContent || "";
        // If height > 55px (more than 3 lines) or text has more than 95 characters, mark it as toast-wide
        if (el.offsetHeight > 55 || text.length > 95) {
          el.classList.add("toast-wide");
        }
        el.dataset.processedWidth = "true";
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      visibleToasts={1}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-md group-[.toaster]:py-1.5 group-[.toaster]:px-2.5 group-[.toaster]:text-[10px] group-[.toaster]:rounded-lg group-[.toaster]:max-w-[320px] group-[.toaster]:min-h-[auto]",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-[9px]",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
