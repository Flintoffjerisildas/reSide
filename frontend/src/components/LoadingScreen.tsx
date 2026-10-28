export default function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="text-lg font-medium text-foreground">Reside</p>
        <p className="text-sm text-muted-foreground">Initializing application...</p>
      </div>
    </div>
  );
}
