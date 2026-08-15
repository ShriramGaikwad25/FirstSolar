import * as yup from "yup";

export const validationSchema = yup.object().shape({
  userType: yup.string().required("User Type is required"),

  specificUserExpression: yup.array().when("userType", {
    is: "Specific users",
    then: (schema) =>
      schema
        .of(
          yup.object().shape({
            attribute: yup.object().nullable().required("Attribute is required"),
            operator: yup.object().nullable().required("Operator is required"),
            value: yup.string().required("Value is required"),
          })
        )
        .min(1, "At least one condition is required"),
    otherwise: (schema) => schema.notRequired(),
  }),
  groupListIsChecked:yup.boolean().default(false),
  userGroupList: yup.string().nullable().default("").when(["userType", "groupListIsChecked"], {
    is: (userType: string, groupListIsChecked: boolean) => userType === "Custom User Group" && !groupListIsChecked,
    then: (schema) => schema.required(),
    otherwise: (schema) => schema.notRequired(),
  }),
  importNewUserGroup: yup
  .mixed<File>()
  .nullable()
  .default(null)
  .when(["userType", "groupListIsChecked"], {
    is: (userType: string, groupListIsChecked: boolean) =>
      userType === "Custom User Group" && groupListIsChecked,
    then: (schema) =>
      schema
        .test("fileRequired", "A file must be uploaded", (value) => {
          return !!(value instanceof File || (Array.isArray(value) && (value as unknown[]).length > 0));
        })
        .test("fileType", "Only CSV or Excel files are allowed", (value) => {
          if (!value) return false; // Ensure a file is selected
          const allowedTypes = [
            "text/csv",
            "application/vnd.ms-excel", // .xls
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
          ];
          return value instanceof File && allowedTypes.includes(value.type);
        })
        .required("A file must be uploaded"),
    otherwise: (schema) => schema.nullable().notRequired().default(null),
  }),

  excludeUsersIsChecked: yup.boolean(),
  // excludeUsers: yup.string().nullable().default("").when("excludeUsersIsChecked", {
  //   is: true,
  //   then: (schema) => schema.required(),
  //   otherwise: (schema) => schema.transform(() => null).notRequired(), // Reset to null
  // }),

  selectData: yup.string().required(),

  specificApps: yup.array().when("selectData", {
    is: "Specific Applications",
    then: (schema) => schema.min(1, "Select at least one application").required(),
    otherwise: (schema) => schema.notRequired(),
  }),

  expressionApps: yup.array().when("selectData", {
    is: "Specific Applications",
    then: (schema) =>
      schema
        .of(
          yup.object().shape({
            attribute: yup.object().nullable().required("Attribute is required"),
            operator: yup.object().nullable().required("Operator is required"),
            value: yup.string().required("Value is required"),
          })
        )
        .min(1, "At least one condition is required"),
    otherwise: (schema) => schema.notRequired(),
  }),
  
  expressionEntitlement: yup.array().when("selectData", {
    is: "Select Entitlement",
    then: (schema) =>
      schema
        .of(
          yup.object().shape({
            attribute: yup.object().nullable().required("Attribute is required"),
            operator: yup.object().nullable().required("Operator is required"),
            value: yup.string().required("Value is required"),
          })
        )
        .min(1, "At least one condition is required"),
    otherwise: (schema) => schema.notRequired(),
  }),

});