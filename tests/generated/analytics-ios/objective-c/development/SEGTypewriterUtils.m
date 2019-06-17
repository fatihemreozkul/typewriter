/**
 *  This client was automatically generated by Segment Typewriter. ** Do Not Edit **
 */

#import <Analytics/SEGSerializableValue.h>
#import "SEGTypewriterUtils.h"

@implementation SEGTypewriterUtils

+ (nonnull SERIALIZABLE_DICT)withTypewriterContextFields:(nullable SERIALIZABLE_DICT)options
{
  options = options ?: @{};
  NSDictionary<NSString *, id> *customContext = options[@"context"] ?: @{};
  NSDictionary<NSString *, id> *typewriterContext = @{
    @"typewriter": @{
      @"language": @"objective-c",
      @"version": @"1.0.0"
    }
  };
  NSMutableDictionary *context = [NSMutableDictionary dictionaryWithCapacity:customContext.count + typewriterContext.count];
  [context addEntriesFromDictionary:customContext];
  [context addEntriesFromDictionary:typewriterContext];
  
  NSMutableDictionary *newOptions = [NSMutableDictionary dictionaryWithCapacity:options.count + 1];
  [newOptions addEntriesFromDictionary:options];
  [newOptions addEntriesFromDictionary:@{
    @"context": context
  }];

  return newOptions;
}

@end
