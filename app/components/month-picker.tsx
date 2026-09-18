"use client";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

export function monthChoices(year: number, min: string, max: string) {
  return Array.from({ length: 12 }, (_, index) => {
    const value = `${year}-${String(index + 1).padStart(2, "0")}`;
    return { value, label: `${index + 1}월`, disabled: value < min || value > max };
  });
}

export function MonthPicker({
  name,
  defaultValue,
  min = "2006-01",
  max,
  disabled = false,
}: {
  name: string;
  defaultValue: string;
  min?: string;
  max: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(defaultValue),
    [year, setYear] = useState(Number(defaultValue.slice(0, 4)));
  const details = useRef<HTMLDetailsElement>(null),
    minYear = Number(min.slice(0, 4)),
    maxYear = Number(max.slice(0, 4));
  return (
    <div className="month-picker">
      <input type="hidden" name={name} value={value} />
      <details ref={details}>
        <summary aria-label={`${name} 월 선택`}>
          <CalendarDays size={17} />
          {value.replace("-", "년 ")}월
        </summary>
        <div className="month-calendar">
          <div className="month-calendar-head">
            <button
              type="button"
              aria-label="이전 연도"
              disabled={disabled || year <= minYear}
              onClick={() => setYear((y) => y - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <strong>{year}년</strong>
            <button
              type="button"
              aria-label="다음 연도"
              disabled={disabled || year >= maxYear}
              onClick={() => setYear((y) => y + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="month-grid">
            {monthChoices(year, min, max).map((month) => (
              <button
                type="button"
                key={month.value}
                disabled={disabled || month.disabled}
                className={value === month.value ? "selected" : ""}
                onClick={() => {
                  setValue(month.value);
                  details.current?.removeAttribute("open");
                }}
              >
                {month.label}
              </button>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
