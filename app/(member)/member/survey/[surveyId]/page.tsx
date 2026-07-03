import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireMemberPortalAccess } from "@/features/member/lib/access";
import { NPSSurveyForm } from "./survey-form";

export default async function MemberSurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ surveyId: string }>;
  searchParams: Promise<{ memberId?: string }>;
}) {
  const context = await requireMemberPortalAccess("/member/survey");
  const { surveyId } = await params;
  const { memberId } = await searchParams;

  if (!surveyId) {
    redirect("/member");
  }

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = supabase as unknown as any;

  const { data: survey } = await s
    .from("nps_surveys")
    .select("id, question, thank_you_message, organization_id")
    .eq("id", surveyId)
    .single();

  if (!survey) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h1 className="text-2xl font-black">Survey Not Found</h1>
        <p className="mt-2 text-muted-foreground">
          This survey may have been removed or the link is invalid.
        </p>
      </div>
    );
  }

  let alreadyResponded = false;
  let memberIdFinal = memberId;

  if (!memberIdFinal && context.userId) {
    const { data: member } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    memberIdFinal = member?.id;
  }

  if (memberIdFinal) {
    const { data: existing } = await s
      .from("nps_responses")
      .select("id")
      .eq("survey_id", surveyId)
      .eq("member_id", memberIdFinal)
      .maybeSingle();
    alreadyResponded = !!existing;
  }

  const question = survey.question as string;
  const thankYouMessage = survey.thank_you_message as string;

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <h1 className="text-3xl font-black">Member Survey</h1>
      <p className="text-muted-foreground">{question}</p>
      <NPSSurveyForm
        surveyId={surveyId}
        memberId={memberIdFinal}
        question={question}
        thankYouMessage={thankYouMessage}
        alreadyResponded={alreadyResponded}
      />
    </div>
  );
}
