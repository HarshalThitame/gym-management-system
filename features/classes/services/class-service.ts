import { addDays, formatISO, subDays } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ClassCategoryRow,
  ClassOperationsDashboard,
  ClassRow,
  ClassSessionRow,
  ClassSessionWithClass,
  ClassTrainerRow,
  ClassWithCategory,
  MemberClassesPortal,
  TrainerClassesPortal
} from "@/types/classes";
import type { MembershipRow } from "@/types/membership";
import type { TrainerRow } from "@/types/training";

type ListClassesInput = {
  gymId: string | null;
  query?: string | undefined;
  status?: string | undefined;
  categoryId?: string | undefined;
  page?: number;
  pageSize?: number;
};

type ClassReportType = "attendance" | "bookings" | "no_shows" | "waitlists" | "trainer_sessions";

export async function listClassCategories(gymId: string | null) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_categories")
    .select("*")
    .or(gymId ? `gym_id.is.null,gym_id.eq.${gymId}` : "gym_id.is.null")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function listClasses(input: ListClassesInput) {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(input.page ?? 1, 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 5), 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("classes")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (input.gymId) {
    query = query.eq("gym_id", input.gymId);
  }

  if (input.query) {
    const escaped = input.query.replace(/[%_,]/g, "");
    query = query.or(`name.ilike.%${escaped}%,description.ilike.%${escaped}%,slug.ilike.%${escaped}%`);
  }

  if (input.status && input.status !== "all") {
    query = query.eq("status", input.status as ClassRow["status"]);
  }

  if (input.categoryId && input.categoryId !== "all") {
    query = query.eq("category_id", input.categoryId);
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const classes = await attachClassData(data ?? []);
  return {
    classes,
    total: count ?? classes.length,
    page,
    pageSize
  };
}

export async function getClassOperationsDashboard(gymId: string | null): Promise<ClassOperationsDashboard> {
  const supabase = await createSupabaseServerClient();
  const today = formatISO(new Date(), { representation: "date" });
  const next30 = formatISO(addDays(new Date(), 30), { representation: "date" });
  const last14 = formatISO(subDays(new Date(), 14), { representation: "date" });

  const [classResult, sessionResult, todayResult, bookingsResult, waitlistsResult, utilizationResult, trendResult] = await Promise.all([
    queryByGym(supabase.from("classes").select("*").order("created_at", { ascending: false }).limit(30), gymId),
    queryByGym(supabase.from("class_sessions").select("*").gte("session_date", today).lte("session_date", next30).order("session_date", { ascending: true }).order("starts_at", { ascending: true }).limit(80), gymId),
    queryByGym(supabase.from("class_sessions").select("id").eq("session_date", today), gymId),
    queryByGym(supabase.from("class_bookings").select("id").in("status", ["booked", "checked_in", "attended"]), gymId),
    queryByGym(supabase.from("class_waitlists").select("id").eq("status", "waiting"), gymId),
    queryByGym(supabase.from("class_session_utilization").select("*").gte("session_date", today).order("session_date", { ascending: true }).limit(100), gymId),
    queryByGym(supabase.from("class_booking_trends").select("*").gte("booking_date", last14).order("booking_date", { ascending: true }), gymId)
  ]);

  const results = [classResult, sessionResult, todayResult, bookingsResult, waitlistsResult, utilizationResult, trendResult];
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const classes = await attachClassData(classResult.data ?? []);
  const sessions = await attachSessionData(sessionResult.data ?? []);
  const utilizationRows = utilizationResult.data ?? [];
  const fillRates = utilizationRows.map((row) => Number(row.fill_rate ?? 0));
  const averageFillRate = fillRates.length > 0 ? Math.round(fillRates.reduce((total, value) => total + value, 0) / fillRates.length) : 0;
  const popularMap = new Map<string, { className: string; sessions: number; fillRateTotal: number }>();

  for (const row of utilizationRows) {
    const className = row.class_name ?? "Class";
    const current = popularMap.get(className) ?? { className, sessions: 0, fillRateTotal: 0 };
    current.sessions += 1;
    current.fillRateTotal += Number(row.fill_rate ?? 0);
    popularMap.set(className, current);
  }

  return {
    metrics: {
      totalClasses: classResult.data?.length ?? 0,
      upcomingSessions: sessionResult.data?.length ?? 0,
      todaySessions: todayResult.data?.length ?? 0,
      activeBookings: bookingsResult.data?.length ?? 0,
      waitlistedMembers: waitlistsResult.data?.length ?? 0,
      averageFillRate
    },
    classes,
    sessions,
    utilization: utilizationRows.slice(0, 12).map((row) => ({
      className: row.class_name ?? "Class",
      fillRate: Number(row.fill_rate ?? 0),
      booked: row.booked_count ?? 0,
      capacity: row.capacity ?? 0
    })),
    bookingTrend: (trendResult.data ?? []).map((row) => ({
      date: row.booking_date ?? "",
      bookings: row.total_bookings ?? 0,
      cancellations: row.cancellations ?? 0
    })),
    popularClasses: Array.from(popularMap.values())
      .map((item) => ({ className: item.className, sessions: item.sessions, fillRate: Math.round(item.fillRateTotal / Math.max(item.sessions, 1)) }))
      .sort((a, b) => b.fillRate - a.fillRate)
      .slice(0, 8)
  };
}

export async function getMemberClassesPortal(userId: string): Promise<MemberClassesPortal | null> {
  const supabase = await createSupabaseServerClient();
  const { data: member, error: memberError } = await supabase.from("members").select("*").eq("user_id", userId).maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    return null;
  }

  const today = formatISO(new Date(), { representation: "date" });
  const next30 = formatISO(addDays(new Date(), 30), { representation: "date" });
  const [sessionsResult, bookingsResult, waitlistsResult, attendanceResult] = await Promise.all([
    queryByGym(supabase.from("class_sessions").select("*").gte("session_date", today).lte("session_date", next30).eq("status", "scheduled").order("session_date", { ascending: true }).order("starts_at", { ascending: true }).limit(80), member.gym_id),
    supabase.from("class_bookings").select("*").eq("member_id", member.id).order("booked_at", { ascending: false }).limit(60),
    supabase.from("class_waitlists").select("*").eq("member_id", member.id).order("joined_at", { ascending: false }).limit(40),
    supabase.from("class_attendance").select("*").eq("member_id", member.id).order("marked_at", { ascending: false }).limit(60)
  ]);

  const results = [sessionsResult, bookingsResult, waitlistsResult, attendanceResult];
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const sessionIds = Array.from(new Set([
    ...(bookingsResult.data ?? []).map((booking) => booking.session_id),
    ...(waitlistsResult.data ?? []).map((waitlist) => waitlist.session_id)
  ]));
  const historicSessions = sessionIds.length > 0 ? await getSessionsById(sessionIds) : new Map<string, ClassSessionWithClass>();

  return {
    member,
    availableSessions: await attachSessionData(sessionsResult.data ?? []),
    bookings: (bookingsResult.data ?? []).map((booking) => ({ ...booking, session: historicSessions.get(booking.session_id) ?? null })),
    waitlists: (waitlistsResult.data ?? []).map((waitlist) => ({ ...waitlist, session: historicSessions.get(waitlist.session_id) ?? null })),
    attendance: attendanceResult.data ?? []
  };
}

export async function getTrainerClassesPortal(userId: string, gymId: string | null): Promise<TrainerClassesPortal> {
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
    return { trainer: null, sessions: [], bookings: [], utilization: [] };
  }

  const today = formatISO(new Date(), { representation: "date" });
  const next30 = formatISO(addDays(new Date(), 30), { representation: "date" });
  const { data: classTrainerRows, error: classTrainerError } = await supabase.from("class_trainers").select("*").eq("trainer_id", trainer.id).eq("status", "active");
  if (classTrainerError) {
    throw new Error(classTrainerError.message);
  }
  const classIds = (classTrainerRows ?? []).map((row) => row.class_id);

  let sessionQuery = supabase
    .from("class_sessions")
    .select("*")
    .gte("session_date", today)
    .lte("session_date", next30)
    .order("session_date", { ascending: true })
    .order("starts_at", { ascending: true })
    .limit(100);

  if (gymId) {
    sessionQuery = sessionQuery.eq("gym_id", gymId);
  }

  if (classIds.length > 0) {
    sessionQuery = sessionQuery.or(`primary_trainer_id.eq.${trainer.id},substitute_trainer_id.eq.${trainer.id},class_id.in.(${classIds.join(",")})`);
  } else {
    sessionQuery = sessionQuery.or(`primary_trainer_id.eq.${trainer.id},substitute_trainer_id.eq.${trainer.id}`);
  }

  const { data: sessionRows, error: sessionError } = await sessionQuery;
  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const sessions = await attachSessionData(sessionRows ?? []);
  const sessionIds = sessions.map((session) => session.id);
  const [bookingsResult, utilizationResult] = await Promise.all([
    sessionIds.length > 0 ? supabase.from("class_bookings").select("*").in("session_id", sessionIds).in("status", ["booked", "checked_in", "attended"]).order("booked_at", { ascending: true }) : { data: [], error: null },
    sessionIds.length > 0 ? supabase.from("class_session_utilization").select("*").in("session_id", sessionIds) : { data: [], error: null }
  ]);

  if (bookingsResult.error || utilizationResult.error) {
    throw new Error(bookingsResult.error?.message ?? utilizationResult.error?.message ?? "Trainer class data failed.");
  }

  return {
    trainer,
    sessions,
    bookings: bookingsResult.data ?? [],
    utilization: (utilizationResult.data ?? []).map((row) => ({
      className: row.class_name ?? "Class",
      fillRate: Number(row.fill_rate ?? 0),
      attended: row.attended_count ?? 0
    }))
  };
}

export async function getClassReportRows(gymId: string | null, type: ClassReportType) {
  const supabase = await createSupabaseServerClient();
  if (type === "attendance") {
    const result = await queryByGym(supabase.from("class_attendance").select("*").order("marked_at", { ascending: false }).limit(5000), gymId);
    if (result.error) throw new Error(result.error.message);
    return { type, rows: result.data ?? [] };
  }
  if (type === "waitlists") {
    const result = await queryByGym(supabase.from("class_waitlists").select("*").order("joined_at", { ascending: false }).limit(5000), gymId);
    if (result.error) throw new Error(result.error.message);
    return { type, rows: result.data ?? [] };
  }
  if (type === "trainer_sessions") {
    const result = await queryByGym(supabase.from("class_trainer_summary").select("*").order("session_count", { ascending: false }).limit(2000), gymId);
    if (result.error) throw new Error(result.error.message);
    return { type, rows: result.data ?? [] };
  }
  if (type === "no_shows") {
    const result = await queryByGym(supabase.from("class_bookings").select("*").in("status", ["absent", "no_show"]).order("booked_at", { ascending: false }).limit(5000), gymId);
    if (result.error) throw new Error(result.error.message);
    return { type, rows: result.data ?? [] };
  }

  const result = await queryByGym(supabase.from("class_bookings").select("*").order("booked_at", { ascending: false }).limit(5000), gymId);
  if (result.error) throw new Error(result.error.message);
  return { type: "bookings" as const, rows: result.data ?? [] };
}

export async function getActiveMembershipForMember(memberId: string): Promise<MembershipRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("*")
    .eq("member_id", memberId)
    .eq("status", "active")
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function attachClassData(classes: ClassRow[]): Promise<ClassWithCategory[]> {
  const categoryIds = Array.from(new Set(classes.map((classRow) => classRow.category_id).filter((id): id is string => Boolean(id))));
  const classIds = classes.map((classRow) => classRow.id);
  const [categoriesById, primaryTrainersByClassId] = await Promise.all([
    getCategoriesById(categoryIds),
    getPrimaryTrainersByClassId(classIds)
  ]);

  return classes.map((classRow) => ({
    ...classRow,
    category: pickCategory(classRow.category_id ? categoriesById.get(classRow.category_id) : undefined),
    primaryTrainer: primaryTrainersByClassId.get(classRow.id) ?? null
  }));
}

async function attachSessionData(sessions: ClassSessionRow[]): Promise<ClassSessionWithClass[]> {
  if (sessions.length === 0) {
    return [];
  }

  const classIds = Array.from(new Set(sessions.map((session) => session.class_id)));
  const trainerIds = Array.from(new Set(sessions.flatMap((session) => [session.substitute_trainer_id, session.primary_trainer_id]).filter((id): id is string => Boolean(id))));
  const [classesById, categoriesById, trainersById, primaryTrainersByClassId] = await Promise.all([
    getClassesById(classIds),
    getCategoriesForClasses(classIds),
    getTrainersById(trainerIds),
    getPrimaryTrainersByClassId(classIds)
  ]);

  return sessions.map((session) => {
    const classRow = classesById.get(session.class_id);
    const trainer = session.substitute_trainer_id
      ? trainersById.get(session.substitute_trainer_id)
      : session.primary_trainer_id
        ? trainersById.get(session.primary_trainer_id)
        : undefined;
    return {
      ...session,
      class: classRow ? {
        id: classRow.id,
        name: classRow.name,
        difficulty: classRow.difficulty,
        duration_minutes: classRow.duration_minutes,
        cancellation_window_hours: classRow.cancellation_window_hours,
        membership_access: classRow.membership_access,
        price_amount: classRow.price_amount,
        requires_approval: classRow.requires_approval
      } : null,
      category: classRow ? pickCategory(categoriesById.get(classRow.id)) : null,
      trainer: pickTrainer(trainer) ?? primaryTrainersByClassId.get(session.class_id) ?? null
    };
  });
}

async function getSessionsById(sessionIds: string[]) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("class_sessions").select("*").in("id", sessionIds);
  if (error) {
    throw new Error(error.message);
  }
  const sessions = await attachSessionData(data ?? []);
  return new Map(sessions.map((session) => [session.id, session]));
}

async function getClassesById(classIds: string[]) {
  if (classIds.length === 0) {
    return new Map<string, ClassRow>();
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("classes").select("*").in("id", classIds);
  if (error) {
    throw new Error(error.message);
  }
  return new Map((data ?? []).map((classRow) => [classRow.id, classRow]));
}

async function getCategoriesById(categoryIds: string[]) {
  if (categoryIds.length === 0) {
    return new Map<string, ClassCategoryRow>();
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("class_categories").select("*").in("id", categoryIds);
  if (error) {
    throw new Error(error.message);
  }
  return new Map((data ?? []).map((category) => [category.id, category]));
}

async function getCategoriesForClasses(classIds: string[]) {
  if (classIds.length === 0) {
    return new Map<string, ClassCategoryRow>();
  }
  const classesById = await getClassesById(classIds);
  const categoriesById = await getCategoriesById(Array.from(new Set(Array.from(classesById.values()).map((classRow) => classRow.category_id).filter((id): id is string => Boolean(id)))));
  return new Map(Array.from(classesById.values()).flatMap((classRow) => {
    const category = classRow.category_id ? categoriesById.get(classRow.category_id) : undefined;
    return category ? [[classRow.id, category] as const] : [];
  }));
}

async function getPrimaryTrainersByClassId(classIds: string[]) {
  if (classIds.length === 0) {
    return new Map<string, Pick<TrainerRow, "id" | "display_name" | "employee_code">>();
  }
  const supabase = await createSupabaseServerClient();
  const { data: assignments, error } = await supabase.from("class_trainers").select("*").in("class_id", classIds).eq("role", "primary").eq("status", "active");
  if (error) {
    throw new Error(error.message);
  }
  const trainerIds = (assignments ?? []).map((assignment: ClassTrainerRow) => assignment.trainer_id);
  const trainersById = await getTrainersById(trainerIds);
  return new Map((assignments ?? []).flatMap((assignment: ClassTrainerRow) => {
    const trainer = pickTrainer(trainersById.get(assignment.trainer_id));
    return trainer ? [[assignment.class_id, trainer] as const] : [];
  }));
}

async function getTrainersById(trainerIds: string[]) {
  if (trainerIds.length === 0) {
    return new Map<string, TrainerRow>();
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("trainers").select("*").in("id", Array.from(new Set(trainerIds)));
  if (error) {
    throw new Error(error.message);
  }
  return new Map((data ?? []).map((trainer) => [trainer.id, trainer]));
}

function pickCategory(category?: ClassCategoryRow) {
  if (!category) return null;
  return { id: category.id, name: category.name, slug: category.slug, color_token: category.color_token };
}

function pickTrainer(trainer?: TrainerRow) {
  if (!trainer) return null;
  return { id: trainer.id, display_name: trainer.display_name, employee_code: trainer.employee_code };
}

function queryByGym<T extends { eq: (column: string, value: string) => T }>(query: T, gymId: string | null) {
  return gymId ? query.eq("gym_id", gymId) : query;
}
