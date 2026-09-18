type Source = {
  id: string;
  nickname: string;
  joined_at: string;
  property_count: number;
  ticket_count: number;
  last_activity_at: string | null;
  [key: string]: unknown;
};
export function publicAdminUser(row: Source) {
  return {
    id: row.id,
    nickname: row.nickname,
    joinedAt: row.joined_at,
    propertyCount: Number(row.property_count),
    ticketCount: Number(row.ticket_count),
    lastActivityAt: row.last_activity_at,
  };
}
