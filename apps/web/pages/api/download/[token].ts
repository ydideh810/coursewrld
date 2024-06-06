import { Media } from "@courselit/common-models";
import {
    createReadStream,
    createWriteStream,
    existsSync,
    mkdirSync,
    unlinkSync,
} from "fs";
import { NextApiRequest, NextApiResponse } from "next";
import nc from "next-connect";
import path from "path";
import { responses } from "../../../config/strings";
import { getMedia } from "../../../graphql/media/logic";
import connectDb from "../../../middlewares/connect-db";
import verifyDomain from "../../../middlewares/verify-domain";
import ApiRequest from "../../../models/ApiRequest";
import CourseModel, { Course } from "../../../models/Course";
import DownloadLinkModel, { DownloadLink } from "../../../models/DownloadLink";
import LessonModel, { Lesson } from "../../../models/Lesson";
import { error } from "../../../services/logger";
import { Readable } from "node:stream";
import archiver from "archiver";
import { Progress } from "../../../models/Progress";
import UserModel, { User } from "../../../models/User";

export default nc<NextApiRequest, NextApiResponse>({
    onError: (
        err: Error,
        req: NextApiResponse,
        res: NextApiResponse,
        next: any,
    ) => {
        error(err.message, {
            fileName: `/api/payment/initiate.ts`,
            stack: err.stack,
        });
        res.status(500).json({ error: err.message });
    },
    onNoMatch: (req: NextApiRequest, res: NextApiResponse) => {
        res.status(404).end("Not found");
    },
    attachParams: true,
})
    .use(connectDb)
    .use(verifyDomain)
    .get(downloadFiles);

async function downloadFiles(req: ApiRequest, res: NextApiResponse) {
    const { token } = req.query;

    const downloadLink: DownloadLink | null = await DownloadLinkModel.findOne({
        token,
    });
    if (!downloadLink) {
        return res.status(404).send(responses.item_not_found);
    }
    if (downloadLink.expiresAt.getTime() - Date.now() < 0) {
        await (downloadLink as any).remove();
        return res.status(404).send(responses.download_link_expired);
    }

    const course: Course | null = await CourseModel.findOne({
        domain: req.subdomain?._id,
        courseId: downloadLink.courseId,
        published: true,
    });
    if (!course) {
        return res.status(404).send(responses.item_not_found);
    }

    const allLessons: Lesson[] = await LessonModel.find(
        {
            courseId: course.courseId,
            domain: req.subdomain!._id,
        },
        {
            media: 1,
        },
    );

    if (allLessons.length === 0) {
        return res.status(200).send(responses.digital_download_no_files);
    }

    const targetDirectory = `/tmp/${req.subdomain?.name}/${token.substr(
        0,
        16,
    )}-${Date.now()}`;
    const filesDirectory = "files";
    const targetDirectoryForFiles = `${targetDirectory}/${filesDirectory}`;

    try {
        createFolder(targetDirectory);
        createFolder(targetDirectoryForFiles);
        for (let lesson of allLessons) {
            try {
                const media = await getMedia(lesson.media);
                if (media) {
                    await downloadFile(media, targetDirectoryForFiles);
                }
            } catch (err: any) {
                console.error(err.message);
            }
        }
        const zipFileAddress = await createArchive({
            targetDirectory,
            filesDirectory,
            archiveName: course.title,
        });

        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=${course.title}.zip`,
        );
        const zipStream = createReadStream(zipFileAddress);
        zipStream.on("close", async () => {
            downloadLink.consumed = true;
            await (downloadLink as any).save();
            await recordProgress({
                courseId: downloadLink.courseId,
                userId: downloadLink.userId,
            });
            unlinkSync(targetDirectory);
        });

        return zipStream.pipe(res);
    } catch (err: any) {
        error(err.message, {
            fileName: __filename,
            stack: err.stack,
        });
        res.status(500).send(err.message);
    }
}

function createFolder(folderPath: string) {
    if (!existsSync(folderPath)) {
        mkdirSync(folderPath, { recursive: true });
    }
}

async function downloadFile(media: Media, folderPath: string) {
    const filePath = path.join(folderPath, media.originalFileName);

    try {
        const response: any = await fetch(media.file!);

        const fileStream = createWriteStream(filePath);
        await new Promise((resolve, reject) => {
            const readable = Readable.fromWeb(response.body);
            readable.pipe(fileStream);
            readable.on("error", (err: any) => {
                fileStream.close();
                unlinkSync(filePath);
                reject(err);
            });
            fileStream.on("finish", resolve);
        });
    } catch (err) {
        throw err;
    }
}

function createArchive({
    targetDirectory,
    filesDirectory,
    archiveName,
}: {
    targetDirectory: string;
    filesDirectory: string;
    archiveName: string;
}): Promise<string> {
    return new Promise((resolve, reject) => {
        const outputFileName = `${targetDirectory}/${archiveName}.zip`;
        const output = createWriteStream(outputFileName);
        const archive = archiver("zip", { zlib: { level: 9 } });
        output.on("close", () => {
            resolve(outputFileName);
        });
        archive.on("error", (err: any) => {
            reject(err.message);
        });
        archive.pipe(output);
        archive.directory(`${targetDirectory}/${filesDirectory}/`, false);
        archive.finalize();
    });
}

async function recordProgress({
    courseId,
    userId,
}: {
    courseId: string;
    userId: string;
}) {
    const user: User | null = await UserModel.findOne({ userId });
    if (!user) {
        return;
    }

    const enrolledItemIndex = user.purchases.findIndex(
        (progress: Progress) => progress.courseId === courseId,
    );

    if (enrolledItemIndex === -1) {
        return;
    }

    user.purchases[enrolledItemIndex].downloaded = true;
    await (user as any).save();
}
