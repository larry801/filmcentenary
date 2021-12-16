import {doNotLoseVpAfterCompetitionSchool} from "./game/util";
import {SchoolCardID} from "./types/core";

test('3302', ()=>{
    console.log(doNotLoseVpAfterCompetitionSchool(SchoolCardID.S3201));
});