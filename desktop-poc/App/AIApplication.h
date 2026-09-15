#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

NSUInteger OlympusEditableControlCount(NSString *bundleIdentifier);
BOOL OlympusSendPromptInNewChat(NSString *bundleIdentifier, NSString *prompt, NSError **error);
BOOL OlympusSendPromptInActiveChat(NSString *bundleIdentifier, NSString *prompt, NSError **error);
BOOL OlympusSendPromptWithAttachmentInNewChat(NSString *bundleIdentifier, NSString *prompt, NSURL *attachment, NSError **error);
NSString * _Nullable OlympusWaitForScoredResponse(NSString *bundleIdentifier, NSString *sentPrompt, NSTimeInterval timeout, NSError **error);
NSUInteger OlympusDownloadButtonCount(NSString *bundleIdentifier, NSString *extension);
BOOL OlympusWaitAndPressNewDownload(NSString *bundleIdentifier, NSString *extension, NSUInteger previousCount, NSTimeInterval timeout, NSError **error);
NSUInteger OlympusOfficeDownloadButtonCount(NSString *bundleIdentifier);
BOOL OlympusWaitAndPressNewOfficeDownloads(NSString *bundleIdentifier, NSUInteger previousCount, NSUInteger expectedCount, NSTimeInterval timeout, NSError **error);

NS_ASSUME_NONNULL_END
