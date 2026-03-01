<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Data Model

- MongoDB entities documentation: `src/backend/README.mongodb.md`

## App Flow (from `draft_1.pen`)

This flow describes how the product is expected to work end-to-end based on the current UI draft.

### 1) Onboarding Questionnaire (first run)

User answers a 6-step profile setup:

1. Diet style
2. Allergies and avoids
3. Cuisine preferences
4. Weekday cook-time limit
5. Nutrition target
6. Weekly structure (leftovers, variety, prep)

Then user lands on **Review and Save**:

- persistent defaults are shown (saved preferences),
- current-week intent is shown separately,
- user taps **Save Profile and Build Plan**.

### 2) Home (Today)

Home shows:

- today's target summary,
- today's recipe cards,
- important alerts (expiring soon, low stock),
- action to jump into weekly planning.

### 3) Weekly Planner + AI Edit Loop

- A 7-day plan is generated from saved profile + constraints.
- User can open **Modify/Generate Plan** to chat with AI.
- AI chat supports iterative edits (for example: faster dinners, higher protein, exclusions).
- User taps **Accept Draft** to lock the weekly plan.
- User can build the grocery list from the accepted plan.

### 4) Kitchen Hub (Inventory Operations)

Kitchen has 3 working views:

- **To Buy**: purchase list auto-derived from weekly plan; mark purchased; launch receipt OCR.
- **In Stock**: searchable inventory list; tap item to open detail sheet and edit.
- **Expiring**: prioritize urgent items; add to today's plan or move missing items to To Buy.

Detail flows:

- **Item Detail Sheet**: edit quantity/unit, mark used, or discard.
- **OCR Review**: review extracted receipt lines, edit uncertain lines, then apply updates to inventory.

### 5) Recipes + Cooking Completion

- Recipes screen has segments: **Weekly Planned**, **Favorites**, **History**.
- **Chat with Chef** generates/refines recipe drafts using weekly plan + favorites + in-stock items.
- User accepts a recipe draft, opens recipe detail, then can **Mark as Cooked**.
- Marking cooked should deduct used inventory quantities.

### 6) Confirmation + Feedback Patterns

- Destructive actions use confirmation dialogs.
- Batch inventory updates use confirmation sheets.
- Success/warning/error feedback is shown via toast stack.

## Backend Flow Mapping (Current vs Planned)

### Already in backend

- Auth module (`Supabase` JWT guard/service).
- Inventory items/events persistence in MongoDB.
- Inventory endpoints:
  - `POST /inventory/events`
  - `GET /inventory/home`
  - `GET /inventory/events`

### Planned from app flow

- Onboarding profile persistence (diet, allergies, cuisine, time, nutrition, weekly structure).
- Weekly plan generation + AI revision session state.
- Grocery list generation from accepted weekly plan.
- OCR ingestion + reviewed line-item reconciliation into inventory events.
- Recipes domain (planned/favorite/history) + cook-completion inventory deductions.

### Event-driven expectation for inventory

UI actions should normalize into inventory events (existing event types already support this direction):

- `ADD`: purchased items, OCR-applied additions
- `USE`: mark cooked / consume item quantities
- `DISCARD`: remove spoiled/unused items
- `ADJUST`: manual corrections from item detail/edit forms

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
