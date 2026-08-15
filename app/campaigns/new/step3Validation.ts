import * as yup from "yup";

const allowedFileTypes = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const conditionSchema = yup.object().shape({
  attribute: yup.object().nullable().required("Attribute is required"),
  operator: yup.object().nullable().required("Operator is required"),
  value: yup.string().required("Value is required"),
});

export const stageSchema = yup.object().shape({
  reviewer: yup.string().required("Reviewer is required"),
  duration: yup.string().required("Duration is required"),
  nextReviewerAction: yup.boolean().default(false),
  reviewerlistIsChecked: yup.boolean().default(false),

  genericExpression: yup.array().when(["reviewer", "reviewerlistIsChecked"], {
    is: (reviewer: string, reviewerlistIsChecked: boolean) => reviewer === "custom-reviewer" && !reviewerlistIsChecked,
    then: (schema) => schema.of(conditionSchema).min(1).required("Conditions are required"),
    otherwise: (schema) => schema.notRequired().nullable().default([]),
  }),

  customReviewerlist: yup.mixed().when(["reviewer", "reviewerlistIsChecked"], {
    is: (reviewer: string, isChecked: boolean) => reviewer === "custom-reviewer" && isChecked,
    then: () =>
      yup
        .mixed()
        .required("Custom reviewer list is required")
        .test("fileRequired", "A file must be uploaded", (value) =>
          value instanceof File || (Array.isArray(value) && value.length > 0)
        )
        .test("fileType", "Only CSV or Excel files are allowed", (value) =>
          value instanceof File && allowedFileTypes.includes(value.type)
        ),
    otherwise: (schema) => schema.notRequired().nullable().default(null),
  }),
});

//   multiStageReview: yup.boolean().default(false),
//   stages: yup.array().of(stageSchema).min(1).required("At least one stage is required"),

const validationSchema = yup.object({
  multiStageReview: yup.boolean().required(),
  stages: yup.array().of(
    yup.object({
      reviewer: yup.string().required("Reviewer is required"),
      duration: yup.string().test(
        "duration-required-for-non-initial",
        "Duration is required for stages after the initial reviewer",
        function(value) {
          const { parent, path } = this;
          const stageIndex = parseInt(path.split('.')[1]);
          // Duration is only required for stages after the initial reviewer (index > 0)
          if (stageIndex > 0) {
            return value && value.trim().length > 0;
          }
          return true; // Duration is optional for initial reviewer (index === 0)
        }
      ),
      nextReviewerAction: yup.boolean(),
      reviewerlistIsChecked: yup.boolean(),
      genericExpression: yup.array().of(yup.string()),
      customReviewerlist: yup.string().nullable(),
    })
  ),
});
export default validationSchema;
