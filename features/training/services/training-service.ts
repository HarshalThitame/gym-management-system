import { addDays, formatISO } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberRow } from "@/types/membership";
import type { MemberTrainingPortal, TrainerAssignmentRow, TrainerDashboardData, TrainerDirectoryItem, TrainerProfileBundle, TrainerRow, WorkoutProgramExerciseRow, WorkoutProgramRow } from "@/types/training";

type ListTrainersInput = {
  gymId: string | null;
  query?: string | undefined;
  status?: string | undefined;
  specialization?: string | undefined;
  page?: number;
  pageSize?: number;
};

type TrainingReportType = "sessions" | "assignments" | "ratings" | "staff";

export async function listTrainers(input: ListTrainersInput) {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(input.page ?? 1, 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 5), 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const trainerIdsBySpecialization = await getTrainerIdsBySpecialization(input);

  let query = supabase
    .from("trainers")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (input.gymId) {
    query = query.eq("gym_id", input.gymId);
  }

  if (input.query) {
    const escaped = input.query.replace(/[%_,]/g, "");
    query = query.or(`display_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%,employee_code.ilike.%${escaped}%`);
  }

  if (input.status && input.status !== "all") {
    query = query.eq("status", input.status as TrainerRow["status"]);
  }

  if (trainerIdsBySpecialization) {
    if (trainerIdsBySpecialization.length === 0) {
      return { trainers: [], total: 0, page, pageSize };
    }

    query = query.in("id", trainerIdsBySpecialization);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const trainers = await attachTrainerDirectoryData(data ?? []);

  return {
    trainers,
    total: count ?? trainers.length,
    page,
    pageSize
  };
}

export async function listActiveTrainers(gymId: string | null) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("trainers")
    .select("*")
    .eq("status", "active")
    .order("display_name", { ascending: true });

  if (gymId) {
    query = query.eq("gym_id", gymId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getTrainerProfileBundle(trainerId: string): Promise<TrainerProfileBundle | null> {
  const supabase = await createSupabaseServerClient();
  const { data: trainer, error: trainerError } = await supabase.from("trainers").select("*").eq("id", trainerId).maybeSingle();

  if (trainerError) {
    throw new Error(trainerError.message);
  }

  if (!trainer) {
    return null;
  }

  const [profileResult, specializationsResult, certificationsResult, availabilityResult, assignmentsResult, sessionsResult, programsResult, notesResult, feedbackResult] = await Promise.all([
    supabase.from("trainer_profiles").select("*").eq("trainer_id", trainer.id).maybeSingle(),
    supabase.from("trainer_specializations").select("*").eq("trainer_id", trainer.id).order("created_at", { ascending: true }),
    supabase.from("trainer_certifications").select("*").eq("trainer_id", trainer.id).order("expiry_date", { ascending: true }),
    supabase.from("trainer_availability").select("*").eq("trainer_id", trainer.id).order("day_of_week", { ascending: true }).order("starts_at", { ascending: true }),
    supabase.from("trainer_assignments").select("*").eq("trainer_id", trainer.id).order("assigned_at", { ascending: false }).limit(80),
    supabase.from("trainer_sessions").select("*").eq("trainer_id", trainer.id).order("session_date", { ascending: false }).order("starts_at", { ascending: true }).limit(80),
    supabase.from("workout_programs").select("*").eq("trainer_id", trainer.id).order("created_at", { ascending: false }).limit(40),
    supabase.from("trainer_notes").select("*").eq("trainer_id", trainer.id).order("created_at", { ascending: false }).limit(40),
    supabase.from("trainer_feedback").select("*").eq("trainer_id", trainer.id).order("created_at", { ascending: false }).limit(40)
  ]);

  const results = [profileResult, specializationsResult, certificationsResult, availabilityResult, assignmentsResult, sessionsResult, programsResult, notesResult, feedbackResult];
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const assignments = assignmentsResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const memberIds = Array.from(new Set([...assignments.map((assignment) => assignment.member_id), ...sessions.map((session) => session.member_id)]));
  const membersById = await getMembersById(memberIds);

  return {
    trainer,
    profile: profileResult.data ?? null,
    specializations: specializationsResult.data ?? [],
    certifications: certificationsResult.data ?? [],
    availability: availabilityResult.data ?? [],
    assignments: assignments.map((assignment) => ({ ...assignment, member: pickMember(membersById.get(assignment.member_id)) })),
    sessions: sessions.map((session) => ({ ...session, member: pickSessionMember(membersById.get(session.member_id)) })),
    programs: programsResult.data ?? [],
    notes: notesResult.data ?? [],
    feedback: feedbackResult.data ?? []
  };
}

export async function listPersonalTrainingPackages(gymId: string | null) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("personal_training_packages")
    .select("*")
    .order("status", { ascending: true })
    .order("display_order", { ascending: true })
    .order("price_amount", { ascending: true });

  if (gymId) {
    query = query.eq("gym_id", gymId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getTrainerDashboard(userId: string, gymId: string | null): Promise<TrainerDashboardData> {
  const supabase = await createSupabaseServerClient();
  let trainerQuery = supabase.from("trainers").select("*").eq("user_id", userId);

  if (gymId) {
    trainerQuery = trainerQuery.eq("gym_id", gymId);
  }

  const { data: trainer, error: trainerError } = await trainerQuery.maybeSingle();

  if (trainerError) {
    throw new Error(trainerError.message);
  }

  if (!trainer) {
    return emptyTrainerDashboard();
  }

  const today = todayDate();
  const next30 = formatISO(addDays(new Date(), 30), { representation: "date" });
  const [assignmentsResult, todaySessionsResult, upcomingSessionsResult, completedSessionsResult, ptPackagesResult, feedbackResult] = await Promise.all([
    supabase.from("trainer_assignments").select("*").eq("trainer_id", trainer.id).eq("status", "active").order("assigned_at", { ascending: false }),
    supabase.from("trainer_sessions").select("*").eq("trainer_id", trainer.id).eq("session_date", today).order("starts_at", { ascending: true }),
    supabase.from("trainer_sessions").select("*").eq("trainer_id", trainer.id).gte("session_date", today).lte("session_date", next30).in("status", ["scheduled", "rescheduled"]).order("session_date", { ascending: true }).order("starts_at", { ascending: true }).limit(12),
    supabase.from("trainer_sessions").select("id").eq("trainer_id", trainer.id).eq("status", "completed"),
    supabase.from("member_pt_packages").select("price_amount,status").eq("trainer_id", trainer.id).in("status", ["active", "completed"]),
    supabase.from("trainer_feedback").select("rating").eq("trainer_id", trainer.id).neq("status", "hidden")
  ]);

  const results = [assignmentsResult, todaySessionsResult, upcomingSessionsResult, completedSessionsResult, ptPackagesResult, feedbackResult];
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const assignments = assignmentsResult.data ?? [];
  const todaysSessions = todaySessionsResult.data ?? [];
  const upcomingSessions = upcomingSessionsResult.data ?? [];
  const memberIds = Array.from(new Set([...assignments.map((assignment) => assignment.member_id), ...todaysSessions.map((session) => session.member_id), ...upcomingSessions.map((session) => session.member_id)]));
  const membersById = await getMembersById(memberIds);
  const feedback = feedbackResult.data ?? [];
  const averageRating = feedback.length > 0 ? feedback.reduce((total, item) => total + item.rating, 0) / feedback.length : 0;
  const assignedMembers: Array<MemberRow & { assignment: TrainerAssignmentRow | null }> = [];

  for (const assignment of assignments) {
    const member = membersById.get(assignment.member_id);
    if (member) {
      assignedMembers.push({ ...member, assignment });
    }
  }

  return {
    trainer,
    metrics: {
      assignedMembers: assignments.length,
      todaySessions: todaysSessions.length,
      upcomingSessions: upcomingSessions.length,
      completedSessions: completedSessionsResult.data?.length ?? 0,
      pendingSessions: upcomingSessions.length,
      ptRevenue: (ptPackagesResult.data ?? []).reduce((total, item) => total + item.price_amount, 0),
      averageRating
    },
    assignedMembers,
    todaysSessions: todaysSessions.map((session) => ({ ...session, member: pickSessionMember(membersById.get(session.member_id)) })),
    upcomingSessions: upcomingSessions.map((session) => ({ ...session, member: pickSessionMember(membersById.get(session.member_id)) }))
  };
}

export async function getTrainerAssignedMembers(userId: string, gymId: string | null) {
  const dashboard = await getTrainerDashboard(userId, gymId);
  return dashboard.assignedMembers;
}

export async function getTrainerSessionsForUser(userId: string, gymId: string | null) {
  const dashboard = await getTrainerDashboard(userId, gymId);
  return dashboard.upcomingSessions;
}

export async function getMemberTrainingPortal(userId: string): Promise<MemberTrainingPortal | null> {
  const supabase = await createSupabaseServerClient();
  const { data: member, error: memberError } = await supabase.from("members").select("*").eq("user_id", userId).maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    return null;
  }

  const [assignmentsResult, packagesResult, sessionsResult, programAssignmentsResult, notesResult] = await Promise.all([
    supabase.from("trainer_assignments").select("*").eq("member_id", member.id).eq("status", "active").order("assigned_at", { ascending: false }),
    supabase.from("member_pt_packages").select("*").eq("member_id", member.id).order("created_at", { ascending: false }),
    supabase.from("trainer_sessions").select("*").eq("member_id", member.id).order("session_date", { ascending: false }).order("starts_at", { ascending: true }).limit(30),
    supabase.from("workout_program_assignments").select("*").eq("member_id", member.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("trainer_notes").select("*").eq("member_id", member.id).eq("visibility", "trainer_and_member").order("created_at", { ascending: false }).limit(20)
  ]);

  const results = [assignmentsResult, packagesResult, sessionsResult, programAssignmentsResult, notesResult];
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const assignment = (assignmentsResult.data ?? [])[0] ?? null;
  const trainerIds = Array.from(new Set([
    assignment?.trainer_id,
    ...(packagesResult.data ?? []).map((item) => item.trainer_id),
    ...(sessionsResult.data ?? []).map((session) => session.trainer_id)
  ].filter((id): id is string => Boolean(id))));
  const trainersById = await getTrainersById(trainerIds);
  const programAssignments = programAssignmentsResult.data ?? [];
  const programIds = Array.from(new Set(programAssignments.map((assignmentRow) => assignmentRow.program_id)));
  const [programsById, exercisesByProgramId] = await Promise.all([getProgramsById(programIds), getExercisesByProgramId(programIds)]);

  return {
    member,
    trainer: assignment ? trainersById.get(assignment.trainer_id) ?? null : null,
    packages: packagesResult.data ?? [],
    sessions: (sessionsResult.data ?? []).map((session) => ({ ...session, trainer: pickTrainer(trainersById.get(session.trainer_id)) })),
    programs: programAssignments.map((programAssignment) => ({
      ...programAssignment,
      program: programsById.get(programAssignment.program_id) ?? null,
      exercises: exercisesByProgramId.get(programAssignment.program_id) ?? []
    })),
    notes: notesResult.data ?? []
  };
}

export async function listStaffProfiles(gymId: string | null) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("staff_profiles").select("*").order("created_at", { ascending: false });

  if (gymId) {
    query = query.eq("gym_id", gymId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getTrainingReportRows(gymId: string | null, type: TrainingReportType) {
  const supabase = await createSupabaseServerClient();

  if (type === "sessions") {
    let query = supabase.from("trainer_sessions").select("*").order("session_date", { ascending: false }).limit(1000);
    if (gymId) {
      query = query.eq("gym_id", gymId);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    return { type, rows: data ?? [] };
  }

  if (type === "assignments") {
    let query = supabase.from("trainer_assignments").select("*").order("assigned_at", { ascending: false }).limit(1000);
    if (gymId) {
      query = query.eq("gym_id", gymId);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    return { type, rows: data ?? [] };
  }

  if (type === "ratings") {
    let query = supabase.from("trainer_feedback").select("*").order("created_at", { ascending: false }).limit(1000);
    if (gymId) {
      query = query.eq("gym_id", gymId);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    return { type, rows: data ?? [] };
  }

  let query = supabase.from("staff_profiles").select("*").order("created_at", { ascending: false }).limit(1000);
  if (gymId) {
    query = query.eq("gym_id", gymId);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return { type, rows: data ?? [] };
}

async function getTrainerIdsBySpecialization(input: ListTrainersInput) {
  if (!input.specialization || input.specialization === "all") {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("trainer_specializations")
    .select("trainer_id")
    .eq("specialization", input.specialization as never);

  if (error) {
    throw new Error(error.message);
  }

  return Array.from(new Set((data ?? []).map((row) => row.trainer_id)));
}

async function attachTrainerDirectoryData(trainers: TrainerRow[]): Promise<TrainerDirectoryItem[]> {
  if (trainers.length === 0) {
    return [];
  }

  const trainerIds = trainers.map((trainer) => trainer.id);
  const supabase = await createSupabaseServerClient();
  const [profilesResult, specializationsResult, certificationsResult, assignmentsResult, sessionsResult, feedbackResult] = await Promise.all([
    supabase.from("trainer_profiles").select("*").in("trainer_id", trainerIds),
    supabase.from("trainer_specializations").select("*").in("trainer_id", trainerIds),
    supabase.from("trainer_certifications").select("*").in("trainer_id", trainerIds),
    supabase.from("trainer_assignments").select("trainer_id,status").in("trainer_id", trainerIds).eq("status", "active"),
    supabase.from("trainer_sessions").select("trainer_id,status").in("trainer_id", trainerIds),
    supabase.from("trainer_feedback").select("trainer_id,rating,status").in("trainer_id", trainerIds).neq("status", "hidden")
  ]);

  const results = [profilesResult, specializationsResult, certificationsResult, assignmentsResult, sessionsResult, feedbackResult];
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const profilesByTrainerId = new Map((profilesResult.data ?? []).map((profile) => [profile.trainer_id, profile]));
  const specializationsByTrainerId = groupByTrainerId(specializationsResult.data ?? []);
  const certificationsByTrainerId = groupByTrainerId(certificationsResult.data ?? []);
  const assignments = assignmentsResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const feedback = feedbackResult.data ?? [];

  return trainers.map((trainer) => {
    const trainerFeedback = feedback.filter((item) => item.trainer_id === trainer.id);
    const averageRating = trainerFeedback.length > 0 ? trainerFeedback.reduce((total, item) => total + item.rating, 0) / trainerFeedback.length : 0;

    return {
      ...trainer,
      profile: profilesByTrainerId.get(trainer.id) ?? null,
      specializations: specializationsByTrainerId.get(trainer.id) ?? [],
      certifications: certificationsByTrainerId.get(trainer.id) ?? [],
      activeAssignments: assignments.filter((assignment) => assignment.trainer_id === trainer.id).length,
      upcomingSessions: sessions.filter((session) => session.trainer_id === trainer.id && session.status !== "completed" && session.status !== "cancelled").length,
      completedSessions: sessions.filter((session) => session.trainer_id === trainer.id && session.status === "completed").length,
      averageRating
    };
  });
}

async function getMembersById(memberIds: string[]) {
  if (memberIds.length === 0) {
    return new Map<string, MemberRow>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("members").select("*").in("id", memberIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((member) => [member.id, member]));
}

async function getTrainersById(trainerIds: string[]) {
  if (trainerIds.length === 0) {
    return new Map<string, TrainerRow>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("trainers").select("*").in("id", trainerIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((trainer) => [trainer.id, trainer]));
}

async function getProgramsById(programIds: string[]) {
  if (programIds.length === 0) {
    return new Map<string, WorkoutProgramRow>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("workout_programs").select("*").in("id", programIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((program) => [program.id, program]));
}

async function getExercisesByProgramId(programIds: string[]) {
  if (programIds.length === 0) {
    return new Map<string, WorkoutProgramExerciseRow[]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workout_program_exercises")
    .select("*")
    .in("program_id", programIds)
    .order("day_number", { ascending: true })
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const grouped = new Map<string, WorkoutProgramExerciseRow[]>();
  for (const exercise of data ?? []) {
    const rows = grouped.get(exercise.program_id) ?? [];
    rows.push(exercise);
    grouped.set(exercise.program_id, rows);
  }
  return grouped;
}

function groupByTrainerId<Row extends { trainer_id: string }>(rows: Row[]) {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const current = grouped.get(row.trainer_id) ?? [];
    current.push(row);
    grouped.set(row.trainer_id, current);
  }
  return grouped;
}

function pickMember(member?: MemberRow) {
  if (!member) {
    return null;
  }

  return {
    id: member.id,
    member_code: member.member_code,
    full_name: member.full_name,
    email: member.email,
    phone: member.phone
  };
}

function pickSessionMember(member?: MemberRow) {
  if (!member) {
    return null;
  }

  return {
    id: member.id,
    member_code: member.member_code,
    full_name: member.full_name,
    phone: member.phone
  };
}

function pickTrainer(trainer?: TrainerRow) {
  if (!trainer) {
    return null;
  }

  return {
    id: trainer.id,
    display_name: trainer.display_name,
    photo_url: trainer.photo_url
  };
}

function todayDate() {
  return formatISO(new Date(), { representation: "date" });
}

function emptyTrainerDashboard(): TrainerDashboardData {
  return {
    trainer: null,
    metrics: {
      assignedMembers: 0,
      todaySessions: 0,
      upcomingSessions: 0,
      completedSessions: 0,
      pendingSessions: 0,
      ptRevenue: 0,
      averageRating: 0
    },
    assignedMembers: [],
    todaysSessions: [],
    upcomingSessions: []
  };
}
