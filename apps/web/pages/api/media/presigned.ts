import { NextApiRequest, NextApiResponse } from "next";
import nc from "next-connect";
import { responses } from "../../../config/strings";
import connectDb from "../../../middlewares/connect-db";
import verifyDomain from "../../../middlewares/verify-domain";
import ApiRequest from "../../../models/ApiRequest";
import { error } from "../../../services/logger";
import * as medialitService from "../../../services/medialit";
import { UIConstants as constants } from "@courselit/common-models";
import { checkPermission } from "@courselit/utils";
import setUserFromSession from "../../../middlewares/set-user-from-session";

export default nc<NextApiRequest, NextApiResponse>({
    onError: (err, req, res, next) => {
        error(err.message, {
            fileName: `/api/media/presigned.ts`,
            stack: err.stack,
        });
        res.status(500).json({ error: err.message });
    },
    onNoMatch: (req, res) => {
        res.status(404).end("Not found");
    },
})
    .use(connectDb)
    .use(verifyDomain)
    .use(setUserFromSession)
    .post(getPresignedUrlHandler);

async function getPresignedUrlHandler(req: ApiRequest, res: NextApiResponse) {
    if (
        !checkPermission(req.user!.permissions, [
            constants.permissions.uploadMedia,
        ])
    ) {
        throw new Error(responses.action_not_allowed);
    }
    try {
        let response = await medialitService.getPresignedUrlForUpload(
            req.subdomain!.name,
        );
        return res.status(200).json({ url: response });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
}
