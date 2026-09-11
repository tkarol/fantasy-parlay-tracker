import { ButtonLink, Card, EmptyState } from "../components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card>
        <EmptyState
          icon="🤷"
          title="Page not found"
          description="That link doesn't go anywhere."
          action={<ButtonLink to="/" variant="primary">Go home</ButtonLink>}
        />
      </Card>
    </div>
  );
}
