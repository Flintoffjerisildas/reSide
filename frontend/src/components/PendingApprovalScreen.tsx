import { Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function PendingApprovalScreen() {
  return (
    <div className="container py-8 sm:py-12 lg:py-16 px-4 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Card className="glass-panel border shadow-xl">
          <CardHeader className="text-center space-y-3 sm:space-y-4">
            <div className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-primary/10 text-primary shadow-inner">
              <Clock className="h-8 w-8 sm:h-10 sm:w-10 text-primary animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-xl sm:text-2xl">Account Pending Approval</CardTitle>
              <CardDescription className="text-sm sm:text-base mt-2">
                உங்கள் கணக்கு அங்கீகாரத்திற்காக காத்திருக்கிறது
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <Alert className="glass-surface border-primary/20">
              <AlertCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs sm:text-sm">
                Your registration has been submitted successfully. An administrator will review and approve your account shortly.
                <br />
                <br />
                உங்கள் பதிவு வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது. ஒரு நிர்வாகி விரைவில் உங்கள் கணக்கை மதிப்பாய்வு செய்து அங்கீகரிப்பார்.
              </AlertDescription>
            </Alert>

            <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium text-foreground">Registration Submitted</p>
                  <p className="text-xs sm:text-sm">Your account details have been received</p>
                  <p className="text-[10px] sm:text-xs">உங்கள் கணக்கு விவரங்கள் பெறப்பட்டன</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-secondary/20 text-secondary-foreground text-xs sm:text-sm font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium text-foreground">Under Review</p>
                  <p className="text-xs sm:text-sm">Administrator is reviewing your registration</p>
                  <p className="text-[10px] sm:text-xs">நிர்வாகி உங்கள் பதிவை மதிப்பாய்வு செய்கிறார்</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs sm:text-sm font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Approval Pending</p>
                  <p className="text-xs sm:text-sm">You'll be notified once approved</p>
                  <p className="text-[10px] sm:text-xs">அங்கீகரிக்கப்பட்டவுடன் உங்களுக்கு அறிவிக்கப்படும்</p>
                </div>
              </div>
            </div>

            <div className="glass-surface rounded-xl p-3 sm:p-4 text-center">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Please check back later or contact the administrator if you have any questions.
                <br />
                <br />
                தயவுசெய்து பின்னர் சரிபார்க்கவும் அல்லது ஏதேனும் கேள்விகள் இருந்தால் நிர்வாகியைத் தொடர்பு கொள்ளவும்.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
