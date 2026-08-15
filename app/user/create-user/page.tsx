"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CreateUserForm = {
  firstName: string;
  lastName: string;
  email: string;
  displayName: string;
  alias: string;
  title: string;
  department: string;
  startDate: string;
  userType: string;
  managerEmail: string;
  tags: string;
};

const emptyForm: CreateUserForm = {
  firstName: "",
  lastName: "",
  email: "",
  displayName: "",
  alias: "",
  title: "",
  department: "",
  startDate: "",
  userType: "",
  managerEmail: "",
  tags: "",
};

const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";
/** Grid cell: fills column so inputs use full width of page within the grid */
const cell = "min-w-0 w-full";
const fieldClass =
  "block w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function CreateUserPage() {
  const router = useRouter();
  const [form, setForm] = useState<CreateUserForm>(emptyForm);

  const setField = <K extends keyof CreateUserForm>(key: K, value: CreateUserForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/user");
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 py-8">
      <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Create new user</h1>
          <p className="mt-1 text-sm text-gray-600">
            Enter the user&apos;s details. Required fields should be filled before saving.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              <div className={cell}>
                <label htmlFor="firstName" className={labelClass}>
                  First name
                </label>
                <input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  className={fieldClass}
                  value={form.firstName}
                  onChange={(e) => setField("firstName", e.target.value)}
                />
              </div>
              <div className={cell}>
                <label htmlFor="lastName" className={labelClass}>
                  Last name
                </label>
                <input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  className={fieldClass}
                  value={form.lastName}
                  onChange={(e) => setField("lastName", e.target.value)}
                />
              </div>
              <div className={cell}>
                <label htmlFor="email" className={labelClass}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={fieldClass}
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                />
              </div>
              <div className={cell}>
                <label htmlFor="displayName" className={labelClass}>
                  Display name
                </label>
                <input
                  id="displayName"
                  type="text"
                  className={fieldClass}
                  value={form.displayName}
                  onChange={(e) => setField("displayName", e.target.value)}
                />
              </div>
              <div className={cell}>
                <label htmlFor="alias" className={labelClass}>
                  Username
                </label>
                <input
                  id="alias"
                  type="text"
                  autoComplete="username"
                  className={fieldClass}
                  value={form.alias}
                  onChange={(e) => setField("alias", e.target.value)}
                />
              </div>
              <div className={cell}>
                <label htmlFor="title" className={labelClass}>
                  Title
                </label>
                <input
                  id="title"
                  type="text"
                  className={fieldClass}
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                />
              </div>
              <div className={cell}>
                <label htmlFor="department" className={labelClass}>
                  Department
                </label>
                <input
                  id="department"
                  type="text"
                  className={fieldClass}
                  value={form.department}
                  onChange={(e) => setField("department", e.target.value)}
                />
              </div>
              <div className={cell}>
                <label htmlFor="startDate" className={labelClass}>
                  Start date
                </label>
                <input
                  id="startDate"
                  type="date"
                  className={fieldClass}
                  value={form.startDate}
                  onChange={(e) => setField("startDate", e.target.value)}
                />
              </div>
              <div className={cell}>
                <label htmlFor="userType" className={labelClass}>
                  User type
                </label>
                <input
                  id="userType"
                  type="text"
                  className={fieldClass}
                  value={form.userType}
                  onChange={(e) => setField("userType", e.target.value)}
                />
              </div>
              <div className={cell}>
                <label htmlFor="managerEmail" className={labelClass}>
                  Manager email
                </label>
                <input
                  id="managerEmail"
                  type="email"
                  autoComplete="off"
                  className={fieldClass}
                  value={form.managerEmail}
                  onChange={(e) => setField("managerEmail", e.target.value)}
                />
              </div>
              <div className={cell}>
                <label htmlFor="tags" className={labelClass}>
                  Tags
                </label>
                <input
                  id="tags"
                  type="text"
                  className={fieldClass}
                  placeholder="e.g. Employee, Contractor"
                  value={form.tags}
                  onChange={(e) => setField("tags", e.target.value)}
                />
                <p className="mt-2 text-xs text-gray-500">Separate multiple tags with commas.</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => router.push("/user")}
                className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex justify-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Create user
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
