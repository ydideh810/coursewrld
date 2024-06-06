import { NextApiRequest, NextApiResponse } from "next";
import nc from "next-connect";
import constants from "../../../config/constants";
import { responses } from "../../../config/strings";
import connectDb from "../../../middlewares/connect-db";
import verifyDomain from "../../../middlewares/verify-domain";
import ApiRequest from "../../../models/ApiRequest";
import CourseModel, { Course } from "../../../models/Course";
import { getPaymentMethod } from "../../../payments";
import PurchaseModel from "../../../models/Purchase";
import finalizePurchase from "../../../lib/finalize-purchase";
import { error } from "../../../services/logger";
import setUserFromSession from "../../../middlewares/set-user-from-session";

const { transactionSuccess, transactionFailed, transactionInitiated } =
    constants;

export default nc<NextApiRequest, NextApiResponse>({
    onError: (err, req, res, next) => {
        error(err.message, {
            fileName: `/api/payment/initiate.ts`,
            stack: err.stack,
        });
        res.status(500).json({ error: err.message });
    },
    onNoMatch: (req, res) => {
        res.status(404).end("Not found");
    },
    attachParams: true,
})
    .use(connectDb)
    .use(verifyDomain)
    .use(setUserFromSession)
    .post(initiateHandler);

async function initiateHandler(req: ApiRequest, res: NextApiResponse) {
    const { user, body } = req;
    const { courseid, metadata } = body;

    if (!courseid) {
        return res.status(400).json({ error: responses.invalid_course_id });
    }

    try {
        const course: Course | null = await CourseModel.findOne({
            courseId: courseid,
            domain: req.subdomain!._id,
        });
        if (!course) {
            return res.status(404).json({ error: responses.item_not_found });
        }

        const buyer = user!;
        if (
            buyer.purchases.some(
                (purchase) => purchase.courseId === course.courseId,
            )
        ) {
            return res.status(200).json({
                status: transactionSuccess,
            });
        }

        if (course.cost === 0) {
            try {
                await finalizePurchase(user!.userId, course!.courseId);
                return res.status(200).json({
                    status: transactionSuccess,
                });
            } catch (err: any) {
                return res.status(500).json({ error: err.message });
            }
        }

        const siteinfo = req.subdomain!.settings;
        const paymentMethod = await getPaymentMethod(
            req.subdomain!._id.toString(),
        );

        const purchase = await PurchaseModel.create({
            domain: req.subdomain!._id.toString(),
            courseId: course.courseId,
            purchasedBy: user!.userId,
            paymentMethod: paymentMethod.getName(),
            amount: course.cost * 100,
            currencyISOCode: siteinfo.currencyISOCode,
        });

        const paymentTracker = await paymentMethod.initiate({
            course,
            metadata: JSON.parse(metadata),
            purchaseId: purchase.orderId,
        });

        purchase.paymentId = paymentTracker;
        await purchase.save();

        res.status(200).json({
            status: transactionInitiated,
            paymentTracker,
        });
    } catch (err: any) {
        console.error(err.message, err.stack); // eslint-disable-line no-console
        res.status(500).json({
            status: transactionFailed,
            error: err.message,
        });
    }
}
