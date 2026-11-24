import { BrowseChrome } from "@/ui/components/browse-chrome";
import { NotFoundContent } from "@/ui/components/not-found-content";

// A URL no route matches. It renders outside the route groups, so it brings the browse chrome.
export default function NotFound() {
  return (
    <BrowseChrome>
      <NotFoundContent />
    </BrowseChrome>
  );
}
