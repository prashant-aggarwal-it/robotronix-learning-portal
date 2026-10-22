import {readFileSync} from "node:fs";
const page=readFileSync(new URL("../app/trainer/courses/page.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");
for(const token of ["trainerApprovedCourseGrid","trainerApprovedCourseCard","APPROVED COURSES","CURRENTLY TEACHING","trainer?.courseIds.includes(c.id)","listLearnerProgressRows(t.id)"]){
 if(!(page.includes(token)||css.includes(token)))throw Error("Trainer courses regression: "+token);
}
if(page.includes("{c.level}")||page.includes("APPROVED TEACHING AREAS"))throw Error("Misleading course difficulty labels remain in Trainer My Courses");
if(!css.includes("@media(max-width:620px)"))throw Error("Missing responsive approved-course layout");
console.log("Trainer approved-course UI regression checks passed.");
