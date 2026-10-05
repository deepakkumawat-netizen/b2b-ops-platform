// Indian festivals and national holidays that schools are normally closed
// for. The festival holidays agent marks them on every school's calendar.
// Festivals follow the lunar calendar (and Eid the moon), so their dates
// change every year: add next year's from the Government of India holiday
// list before the current entries run out.
export const INDIAN_FESTIVALS: { date: string; name: string }[] = [
  { date: '2026-10-20', name: 'Dussehra' },
  { date: '2026-11-08', name: 'Diwali' },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti' },
  { date: '2026-12-25', name: 'Christmas' },
  { date: '2027-01-26', name: 'Republic Day' },
  { date: '2027-03-10', name: 'Eid-ul-Fitr' },
  { date: '2027-03-22', name: 'Holi' },
  { date: '2027-03-26', name: 'Good Friday' },
  { date: '2027-08-15', name: 'Independence Day' },
  { date: '2027-10-02', name: 'Gandhi Jayanti' },
  { date: '2027-12-25', name: 'Christmas' },
];
