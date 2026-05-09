import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui';

export function RoleGate({ onSelectRole }) {
  return (
    <main className="min-h-screen bg-background px-8 py-10 text-foreground">
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">iTALA</p>
          <h1 className="mt-3 max-w-xl text-4xl font-medium leading-tight">Offline-first school records, styled for calm daily work.</h1>
          <p className="mt-4 max-w-lg text-muted-foreground">
            Choose a workspace role to continue. Admin tools manage school-level setup, while Teacher tools handle classes, grades, attendance, and forms.
          </p>
        </div>

        <div className="grid gap-5">
          <Card interactive>
            <CardHeader>
              <CardTitle>Admin workspace</CardTitle>
              <CardDescription>Teacher accounts, school utilities, database backup, and configuration.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => onSelectRole('admin')}>
                Continue as Admin
              </Button>
            </CardContent>
          </Card>

          <Card interactive>
            <CardHeader>
              <CardTitle>Teacher workspace</CardTitle>
              <CardDescription>Unlock a local teacher profile to work with classes, gradebooks, attendance, and DepEd forms.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary" onClick={() => onSelectRole('teacher')}>
                Continue as Teacher
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
