import { api_put } from "@/lib/api";
import { driver } from "driver.js";
import { useEffect, useRef } from "react";

interface Props {
  shouldShowTour: boolean;
}

export function ProjectTour({ shouldShowTour }: Props) {
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!shouldShowTour || hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    const tour = driver({
      showProgress: true,
      allowClose: true,
      steps: [
        {
          popover: {
            title: "Welcome to Trident",
            description:
              "A collaborative workspace for working on projects with multiple AI models. Each model thinks and performs differently — bring them together for richer perspectives on your work.",
          },
        },
        {
          element: '[data-tour="chat-left"]',
          popover: {
            title: "Chat with a model",
            description:
              "Start a conversation with a model here. Attach documents, share context, and build up your project together.",
            side: "right",
            align: "center",
          },
        },
        {
          element: '[data-tour="main-content"]',
          popover: {
            title: "Your shared workspace",
            description:
              "Documents and images from any model live here. Hand files between models to get different takes on the same piece of work.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: '[data-tour="chat-right"]',
          popover: {
            title: "Collaborate with another model",
            description:
              "Run a different model alongside the first. Each has its own strengths — use them together to tackle your project from multiple angles.",
            side: "left",
            align: "center",
          },
        },
        {
          element: '[data-tour="help"]',
          popover: {
            title: "Need help?",
            description: "Click here any time to open the full documentation.",
            side: "right",
            align: "center",
          },
        },
      ],
      onDestroyed: () => {
        api_put("/api/settings/project-tour");
      },
    });

    tour.drive();

    return () => {
      if (tour.isActive()) {
        tour.destroy();
      }
    };
  }, [shouldShowTour]);

  return null;
}
