export enum PlanID {
    J01,
    J02,
    J03,
    J04,
    J05,
    J06,
    J07,
    J08,
    J09,
    J10,
    J11,
    J12,
    J13,
    J14,
    J15,
    J16
}

export interface Plan {
    id:PlanID,
    name:string,
    vp:number,
    desc:string,
}