import {expect, test, type Page} from "@playwright/test";

const actions = (page: Page) => page.locator(".vq-actions:visible");
const seat = (page: Page, number: number) => page.getByRole("tab", {name: new RegExp(`^P${number} `)}).click();
const mapSpace = (page: Page, name: string) => page.getByRole("button", {name: new RegExp(`^${name} ·`)}).locator(".vq-hit");

test.beforeEach(({page}) => {page.setDefaultTimeout(10_000);});

async function startTutorial(page: Page) {
    await page.goto("/localVQ/tutorial");
    await page.getByText("English", {exact: true}).click();
    for (const number of [1, 2]) {
        await seat(page, number);
        await page.getByRole("button", {name: /^Confirm .* card draw complete$/}).click();
    }
    for (const number of [1, 2]) {
        await seat(page, number);
        await page.getByRole("button", {name: "End Spring Deployment", exact: true}).click();
    }
    await seat(page, 1);
    await page.getByRole("button", {name: /^View card Grand Vizier/}).click();
    await page.getByRole("button", {name: "As CP", exact: true}).click();
}

async function declineResponses(page: Page) {
    for (let step = 0; step < 8 && await page.locator(".vq-response:visible").count(); step++) {
        if (await actions(page).getByText(/Battle:/).count()) return;
        const banner = await page.locator(".vq-response:visible").innerText();
        const next = banner.match(/Switch to the P(\d) tab/);
        if (next) await seat(page, Number(next[1]));
        const allow = page.getByRole("button", {name: "Allow the action", exact: true});
        if (await allow.count()) await allow.click();
        else await page.getByRole("button", {name: "Finish interception choice", exact: true}).click();
    }
    if (await actions(page).getByText(/Battle:/).count()) return;
    await expect(page.locator(".vq-response:visible")).toHaveCount(0);
    await seat(page, 1);
}

for (const width of [1440, 1100]) {
    test(`land formation stays editable and Edirne is clickable at ${width}px`, async ({page}) => {
        await page.setViewportSize({width, height: 900});
        const errors: string[] = [];
        page.on("console", (message) => {if (message.text().includes("invalid move")) errors.push(message.text());});
        await startTutorial(page);
        await page.getByRole("button", {name: "Land move (1/2 CP)", exact: true}).click();
        await mapSpace(page, "Istanbul").click();
        const regulars = actions(page).getByRole("combobox", {name: "Regular", exact: true});
        await expect(regulars).toHaveText("5");
        await regulars.click();
        await page.getByRole("option", {name: "6", exact: true}).click();
        // Real pointer clicks: an overlay must not cover this legal destination.
        await mapSpace(page, "Edirne").click();
        await expect(actions(page).getByRole("alert")).toContainText("exceed the leaders' command limit");
        await expect(regulars).toHaveText("6");
        await regulars.click();
        await page.getByRole("option", {name: "5", exact: true}).click();
        await mapSpace(page, "Madrid").click();
        await expect(actions(page).getByRole("alert")).toContainText("not a legal target");
        await expect(regulars).toHaveText("5");
        await mapSpace(page, "Edirne").click();
        await declineResponses(page);
        await expect(actions(page)).toContainText("Remaining CP: 4");
        await expect(regulars).toHaveCount(0);
        await expect(actions(page)).toContainText("regulars 5");
        expect(errors).toEqual([]);
    });
}

test("one naval action moves multiple fleets, while another step costs another CP", async ({page}) => {
    await startTutorial(page);
    await page.getByRole("button", {name: "Naval move (1 CP)", exact: true}).click();
    for (const [from, to] of [["Istanbul", "Aegean Sea"], ["Algiers", "Barbary Coast"]]) {
        await mapSpace(page, from).click();
        await mapSpace(page, to).click();
    }
    await expect(page.locator(".vq-naval-orders:visible .MuiChip-root")).toHaveCount(2);
    await page.getByRole("button", {name: "Move selected fleets (1 CP)", exact: true}).click();
    await declineResponses(page);
    await expect(actions(page)).toContainText("Remaining CP: 4");
    await expect(page.locator(".vq-naval-orders:visible .MuiChip-root")).toHaveCount(0);
    await mapSpace(page, "Aegean Sea").click();
    await mapSpace(page, "Eastern Mediterranean").click();
    await page.getByRole("button", {name: "Move selected fleets (1 CP)", exact: true}).click();
    await declineResponses(page);
    await expect(actions(page)).toContainText("Remaining CP: 3");
});

test("hotseat tutorial reaches winter and its turn-three victory", async ({page}) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {if (message.text().includes("invalid move")) errors.push(message.text());});
    await startTutorial(page);
    const years = new Set<string>();
    for (let step = 0; step < 180; step++) {
        if (await actions(page).getByRole("heading", {name: "Game over", exact: true}).count()) break;
        const guide = await page.locator(".vq-guide:visible").innerText();
        if (guide.includes("Tutorial over: review this game")) break;
        const actor = guide.match(/Current action: P(\d)/);
        expect(actor, guide).not.toBeNull();
        await seat(page, Number(actor![1]));
        const year = (await page.locator(".vq-status:visible").innerText()).match(/Turn (\d)/)?.[1];
        if (year) years.add(year);
        const draw = page.getByRole("button", {name: /^Confirm .* card draw complete$/});
        if (await draw.count()) {await draw.click(); continue;}
        const spring = page.getByRole("button", {name: "End Spring Deployment", exact: true});
        if (await spring.count()) {
            const keep = page.getByRole("button", {name: /^Keep /});
            if (await keep.count()) await keep.first().click();
            await spring.click();
            continue;
        }
        const allow = page.getByRole("button", {name: "Allow the action", exact: true});
        if (await allow.count()) {await allow.click(); continue;}
        const papal = page.getByRole("button", {name: "Take no extra benefit", exact: true});
        if (await papal.count()) {await papal.click(); continue;}
        if (await page.locator(".vq-response:visible").count()) {
            throw new Error(`Unexpected event choice: ${await actions(page).innerText()}`);
        }
        const pass = page.getByRole("button", {name: "Pass", exact: true});
        const end = page.getByRole("button", {name: "End impulse", exact: true});
        if (await pass.isEnabled() || await end.isEnabled()) {
            const name = await pass.isEnabled() ? "Pass" : "End impulse";
            await page.getByRole("button", {name, exact: true}).click();
            await page.getByRole("dialog").getByRole("button", {name, exact: true}).click();
            continue;
        }
        const cards = page.locator(".vq-card:visible");
        const mandatory = cards.filter({hasText: "Mandatory event"});
        await (await mandatory.count() ? mandatory.first() : cards.first()).click();
        const cp = page.getByRole("button", {name: "As CP", exact: true});
        if (await cp.isEnabled()) await cp.click();
        else await page.getByRole("button", {name: "As event", exact: true}).click();
    }
    expect([...years]).toEqual(["1", "2", "3"]);
    await expect(actions(page)).toContainText("Winner: P2 Spain");
    await expect(actions(page)).toContainText("Spain wins after turn 3 if the Ottoman Empire has not won");
    await expect(actions(page)).not.toContainText("end of turn 7");
    expect(errors).toEqual([]);
    await page.setViewportSize({width: 390, height: 844});
    await page.getByRole("tab", {name: "Action", exact: true}).click();
    await expect(actions(page)).toContainText("Spain wins after turn 3");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test("naval battle handoffs retain localized dice and casualty information", async ({page}) => {
    test.setTimeout(120_000);
    await startTutorial(page);
    await page.getByRole("button", {name: "Naval move (1 CP)", exact: true}).click();
    await mapSpace(page, "Istanbul").click();
    await mapSpace(page, "Aegean Sea").click();
    await page.getByRole("button", {name: "Move selected fleets (1 CP)", exact: true}).click();
    await declineResponses(page);
    await page.getByRole("button", {name: "End impulse", exact: true}).click();
    await page.getByRole("dialog").getByRole("button", {name: "End impulse", exact: true}).click();
    await seat(page, 2);
    await page.getByRole("button", {name: /^View card Spanish Road/}).click();
    await page.getByRole("button", {name: "As CP", exact: true}).click();
    await page.getByRole("button", {name: "Naval move (1 CP)", exact: true}).click();
    await mapSpace(page, "Messina").click();
    await mapSpace(page, "Ionian Sea").click();
    await page.getByRole("button", {name: "Move selected fleets (1 CP)", exact: true}).click();
    await declineResponses(page);
    await seat(page, 2);
    await mapSpace(page, "Ionian Sea").click();
    await mapSpace(page, "Aegean Sea").click();
    await page.getByRole("button", {name: "Move selected fleets (1 CP)", exact: true}).click();
    await declineResponses(page);
    await expect(actions(page)).toContainText("Battle: Aegean Sea");
    let sawRolls = false;
    for (let step = 0; step < 25 && await page.locator(".vq-response:visible").count(); step++) {
        const guide = await page.locator(".vq-guide:visible").innerText();
        const actor = guide.match(/Current action: P(\d)/);
        expect(actor).not.toBeNull();
        await seat(page, Number(actor![1]));
        const results = page.locator(".vq-battle-results:visible");
        if (await results.count()) {
            sawRolls = true;
            await expect(results).toContainText("Attacker · Spain");
            await expect(results).toContainText("Defender · Ottoman Empire");
            await expect(results).toContainText("hits");
        }
        const choice = actions(page).getByRole("button", {name: /^(Fight$|Continue resolution$|Remove 1 |Retreat to )/}).first();
        await expect(choice).toBeEnabled();
        expect(await choice.textContent()).not.toMatch(/\b(spain|ottoman)\b/);
        await choice.click();
    }
    expect(sawRolls).toBe(true);
    await expect(page.locator(".vq-response:visible")).toHaveCount(0);
    await seat(page, 2);
    await expect(actions(page)).toContainText("Remaining CP: 3");
});

for (const players of [2, 6]) {
    test(`${players}-player campaign hotseat completes the opening phases`, async ({page}) => {
        test.setTimeout(180_000);
        await page.goto("/localVQ");
        await page.getByText("English", {exact: true}).click();
        if (players === 2) {
            await page.getByRole("combobox", {name: "Local hotseat · scenario"}).click();
            await page.getByRole("option", {name: /^Campaign .* · 2 players$/}).click();
        }
        // The two-player English seat also operates the activated Ottoman power.
        const seats = players === 2 ? [2, 1, 2, 1, 2] : [1, 2, 3, 4, 5, 6];
        for (const number of seats) {
            await seat(page, number);
            await page.getByRole("button", {name: /^Confirm .* card draw complete$/}).click();
        }
        for (const number of seats) {
            await seat(page, number);
            await page.getByRole("button", {name: "End diplomacy turn", exact: true}).click();
        }
        for (const number of seats) {
            await seat(page, number);
            const keep = page.getByRole("button", {name: /^Keep /});
            if (await keep.count()) await keep.first().click();
            if (players === 6 && number === 5) await page.getByRole("button", {name: "Catholic", exact: true}).click();
            await page.getByRole("button", {name: "End Spring Deployment", exact: true}).click();
        }
        await seat(page, seats[0]);
        await expect(page.getByRole("button", {name: "Land move (1/2 CP)", exact: true})).toBeVisible();
        await expect(page.getByRole("button", {name: "Naval move (1 CP)", exact: true})).toBeVisible();
    });
}
