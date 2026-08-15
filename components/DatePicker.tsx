import React, { useState, useEffect } from "react";
import DatePicker from "react-multi-date-picker";
import { Controller, Control, FieldValues } from "react-hook-form";

interface DateInputProps {
  control: Control<FieldValues>;
  className?: string;
  name: string;
  showTime?: boolean;
  disabled?: boolean;
}

interface DateTimePickerInnerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  className?: string;
  error?: { message?: string };
  disabled?: boolean;
}

const DateTimePickerInner: React.FC<DateTimePickerInnerProps> = ({ value, onChange, className, error, disabled = false }) => {
  const [timeValue, setTimeValue] = useState<string>("00:00");

  // Initialize time value from existing date value
  useEffect(() => {
    if (value) {
      const date = new Date(value);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      setTimeValue(`${hours}:${minutes}`);
    } else {
      setTimeValue("00:00");
    }
  }, [value]);

  const handleDateChange = (date: any) => {
    if (!date?.isValid) {
      onChange(null);
      return;
    }

    // Combine date with time
    const selectedDate = date.toDate();
    const [hours, minutes] = timeValue.split(':');
    selectedDate.setHours(parseInt(hours, 10));
    selectedDate.setMinutes(parseInt(minutes, 10));
    onChange(selectedDate);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTimeValue(newTime);
    
    if (value) {
      const date = new Date(value);
      const [hours, minutes] = newTime.split(':');
      date.setHours(parseInt(hours, 10));
      date.setMinutes(parseInt(minutes, 10));
      onChange(date);
    } else {
      // If no date selected yet, create a new date with today's date and selected time
      const today = new Date();
      const [hours, minutes] = newTime.split(':');
      today.setHours(parseInt(hours, 10));
      today.setMinutes(parseInt(minutes, 10));
      onChange(today);
    }
  };

  return (
    <div className="flex items-center gap-1 w-full">
      <div className="flex-1 min-w-0">
        <DatePicker
          value={value || ""}
          onChange={handleDateChange}
          inputClass={className}
          format="MM/DD/YYYY"
          disabled={disabled}
        />
      </div>
      <input
        type="time"
        value={timeValue}
        onChange={handleTimeChange}
        disabled={disabled}
        className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 flex-shrink-0 w-36"
      />
      {error && <span className="text-red-500 text-sm mt-1 block">{error.message}</span>}
    </div>
  );
};

const DateInput: React.FC<DateInputProps> = ({ control, className, name, showTime = false, disabled = false }) => {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => {
        if (showTime) {
          return (
            <DateTimePickerInner
              value={value}
              onChange={onChange}
              className={className}
              error={error}
              disabled={disabled}
            />
          );
        }

        return (
          <div className="w-full">
            <DatePicker
              value={value || ""}
              onChange={(date) => {
                console.log("Selected Date:", date?.format?.() || date);
                onChange(date?.isValid ? date.toDate() : null);
              }}
              inputClass={className}
              format="MM/DD/YYYY"
              disabled={disabled}
              containerClassName="w-full"
            />
            {error && <span className="text-red-500">{error.message}</span>}
          </div>
        );
      }}
    />
  );
};

export default DateInput;
